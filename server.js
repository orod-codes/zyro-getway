#!/usr/bin/env node
const http = require('http');
const path = require('path');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const { loadZyroConfig } = require('./scripts/load-zyro-config');

function normalizePairing(raw) {
  const p = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (p.length < 4 || p.length > 12) return null;
  return p;
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const ZYRO_CONFIG = loadZyroConfig(__dirname);
const CONFIG_PATH = ZYRO_CONFIG.configPath;
const PORT =
  ZYRO_CONFIG.port ??
  (process.env.PORT ? Number(process.env.PORT) : 3000);
const CONFIG_PAIRING = normalizePairing(ZYRO_CONFIG.pairingCode) || '';

function publicIp() {
  return ZYRO_CONFIG.ip || getLocalIp();
}

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pairing');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(
  '/zyro',
  express.static(path.join(__dirname, 'dist'), {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js')) res.setHeader('Cache-Control', 'no-store');
    },
  }),
);
app.get('/', (_req, res) => {
  res.json({ ...serverPublicInfo(), endpoints: ['/api/config', '/api/info', '/api/register', '/api/transactions', '/api/notifications', '/api/dashboard', '/api/devices'], clientScript: '/zyro/zyro.js' });
});

/** Server-side settings — port only. Pairing is not configured here. */
app.get('/api/config', (_req, res) => {
  res.json(serverConfigPayload());
});

/** Pairing: request first, else zyro.config.js */
function resolvePairing(req) {
  return (
    normalizePairing(req.query?.pairing) ||
    normalizePairing(req.headers['x-pairing']) ||
    CONFIG_PAIRING ||
    null
  );
}

function requirePairing(req, res) {
  const pairing = resolvePairing(req);
  if (!pairing) {
    res.status(400).json({
      ok: false,
      error: 'pairing required — set pairingCode in zyro.config.js',
    });
    return null;
  }
  return pairing;
}

function serverConfigPayload() {
  return {
    ip: publicIp(),
    port: PORT,
    pairingCode: CONFIG_PAIRING || null,
    configFile: path.basename(CONFIG_PATH),
    configPath: CONFIG_PATH,
    configLoaded: ZYRO_CONFIG.loaded,
    configureInZyroConfigJs: ['ip', 'port', 'pairingCode', 'deviceName'],
  };
}

function serverPublicInfo() {
  const ip = publicIp();
  return {
    name: 'Zyro Gateway',
    mode: 'terminal',
    ...serverConfigPayload(),
    httpUrl: `http://${ip}:${PORT}`,
    wsUrl: `ws://${ip}:${PORT}`,
    hostname: os.hostname(),
    pairingCode: CONFIG_PAIRING || null,
    pairingNote: 'Edit ip, port, pairingCode in zyro.config.js then restart npm start.',
  };
}

app.get('/api/info', (_req, res) => {
  res.json({
    ...serverPublicInfo(),
    features: ['transactions', 'notifications', 'dashboard', 'devices'],
    reachable: true,
  });
});

app.get('/api/dashboard', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const room = getRoom(pairing);
  res.json(buildDashboardPayload(room, pairing));
});

app.get('/api/devices', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const room = getRoom(pairing);
  res.json({
    pairingCode: pairing,
    devices: listDevices(room),
    serverTime: new Date().toISOString(),
  });
});

app.get('/api/transactions', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const room = getRoom(pairing);
  const after = String(req.query.after || '').trim();
  let list = room.transactions;
  if (after) {
    list = list.filter((tx) => {
      const t = String(tx.receivedAt || tx.timestamp || '');
      return t > after;
    });
  } else {
    list = list.slice(0, 50);
  }
  res.json({
    pairingCode: pairing,
    transactions: list,
    serverTime: new Date().toISOString(),
  });
});

app.get('/api/notifications', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const room = getRoom(pairing);
  const after = String(req.query.after || '').trim();
  let list = room.notifications;
  if (after) {
    list = list.filter((n) => String(n.receivedAt || n.timestamp || '') > after);
  } else {
    list = list.slice(0, 50);
  }
  res.json({
    pairingCode: pairing,
    notifications: list,
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/register', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const device = touchHttpPhone(pairing, {
    deviceName: body.deviceName || body.name,
    platform: body.platform,
    deviceId: body.deviceId,
  });
  res.json({ ok: true, pairing, device });
});

app.post('/api/income', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid body' });
  }
  broadcastIncome(pairing, payload);
  bumpPhonePresence(pairing, {
    deviceName: payload.deviceName || payload.sender,
    platform: 'android',
  });
  res.json({ ok: true, pairing });
});

app.post('/api/notification', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid body' });
  }
  broadcastNotification(pairing, payload);
  bumpPhonePresence(pairing, {
    deviceName: payload.title || payload.appName,
    platform: 'android',
  });
  res.json({ ok: true, pairing });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['polling', 'websocket'],
  pingTimeout: 120000,
  pingInterval: 25000,
  connectTimeout: 60000,
  allowEIO3: true,
});

function formatEtb(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '— ETB';
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

function incomeDisplayFields(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const name =
    String(p.name || p.payerName || p.sender || 'Unknown').trim() || 'Unknown';
  const amount = formatEtb(p.amount);
  const sender =
    String(p.smsAddress || p.accountSource || p.sender || '—').trim() || '—';
  const txn =
    String(
      p.transactionNumber || p.referenceNumber || p.transactionId || '—',
    ).trim() || '—';
  return { name, amount, sender, txn };
}

function printIncomeToTerminal(roomKey, payload) {
  const { name, amount, sender, txn } = incomeDisplayFields(payload);
  console.log(`  Income [${roomKey}]`);
  console.log(`    ${amount}  ·  ${name}`);
  console.log(`    Sender ${sender}  ·  Ref ${txn}`);
  console.log('');
}

function broadcastIncome(roomKey, payload) {
  const room = getRoom(roomKey);
  const roomName = `pairing:${roomKey}`;
  const tx = { ...payload, receivedAt: new Date().toISOString() };
  room.transactions.unshift(tx);
  if (room.transactions.length > 500) room.transactions.length = 500;
  printIncomeToTerminal(roomKey, tx);
  io.to(roomName).emit('income_transaction', tx);
  io.to(roomName).emit('dashboard_update', buildDashboardPayload(room, roomKey));
}

function broadcastNotification(roomKey, payload) {
  const room = getRoom(roomKey);
  const roomName = `pairing:${roomKey}`;
  const note = {
    ...payload,
    receivedAt: new Date().toISOString(),
  };
  if (!note.id) note.id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  room.notifications.unshift(note);
  if (room.notifications.length > 200) room.notifications.length = 200;
  io.to(roomName).emit('notification_event', note);
  io.to(roomName).emit('dashboard_update', buildDashboardPayload(room, roomKey));
}

/** Register phone via HTTP (app shows connected but Socket.IO may be off). */
function touchHttpPhone(roomKey, meta = {}) {
  const room = getRoom(roomKey);
  const stableId = String(meta.deviceId || 'phone').replace(/[^a-zA-Z0-9_-]/g, '');
  const id = `http:${roomKey}:${stableId}`;
  const prev = room.deviceMap.get(id);
  const device = {
    id,
    role: 'phone',
    deviceName: meta.deviceName || prev?.deviceName || 'Zyro Phone',
    platform: meta.platform || 'android',
    connectedAt: prev?.connectedAt || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    online: true,
    via: 'http',
  };
  room.deviceMap.set(id, device);
  const roomName = `pairing:${roomKey}`;
  io.to(roomName).emit('presence', presencePayload(room));
  io.to(roomName).emit('device_joined', device);
  printConnectedDevices(roomKey);
  return device;
}

function bumpPhonePresence(roomKey, meta = {}) {
  touchHttpPhone(roomKey, meta);
}

function printStartupForApp() {
  const ip = publicIp();
  console.log('');
  console.log('  Zyro Gateway');
  console.log('  ───────────────────────');
  console.log(`  Config    ${CONFIG_PATH}${ZYRO_CONFIG.loaded ? '' : ' (missing — run npm run config)'}`);
  console.log(`  Pairing   ${CONFIG_PAIRING || '— set pairingCode in zyro.config.js'}`);
  console.log(`  App       IP ${ip}   port ${PORT}`);
  console.log('');
  console.log('  Connected: (waiting…)');
  console.log('  Income:    logs name · amount · sender · ref below');
  console.log('');
}

const _connectedPrintKey = new Map();

function printConnectedDevices(roomKey) {
  const room = getRoom(roomKey);
  const devices = listDevices(room);
  const fingerprint = devices.map((d) => `${d.role}:${d.deviceName}`).join('|') || '(none)';
  if (_connectedPrintKey.get(roomKey) === fingerprint) return;
  _connectedPrintKey.set(roomKey, fingerprint);

  console.log(`  Connected [${roomKey}]:`);
  if (devices.length === 0) {
    console.log('    (none)');
  } else {
    for (const d of devices) {
      const icon = d.role === 'phone' ? '📱' : '🖥️';
      const via = d.via === 'http' ? ' · HTTP' : '';
      console.log(`    ${icon} ${d.deviceName}${via}`);
    }
  }
  console.log('');
}

/** @type {Map<string, RoomState>} */
const rooms = new Map();

function getRoom(pairing) {
  const key = pairing.toUpperCase();
  if (!rooms.has(key)) {
    rooms.set(key, {
      phones: 0,
      desktops: 0,
      transactions: [],
      notifications: [],
      deviceMap: new Map(),
    });
  }
  return rooms.get(key);
}

function listDevices(room) {
  return Array.from(room.deviceMap.values()).sort(
    (a, b) => new Date(b.connectedAt) - new Date(a.connectedAt),
  );
}

function presencePayload(room) {
  const devices = listDevices(room);
  return {
    phones: devices.filter((d) => d.role === 'phone').length,
    desktops: devices.filter((d) => d.role === 'desktop').length,
    devices,
  };
}

function buildDashboardPayload(room, roomKey) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayTx = room.transactions.filter((tx) => {
    const t = new Date(tx.timestamp || tx.receivedAt);
    return t >= start;
  });
  const todayTotal = todayTx.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const matchedNotes = room.notifications.filter((n) => n.matched).length;

  return {
    serverTime: new Date().toISOString(),
    pairingCode: roomKey,
    stats: {
      todayTotal,
      transactionCount: room.transactions.length,
      todayTransactionCount: todayTx.length,
      notificationCount: room.notifications.length,
      matchedNotificationCount: matchedNotes,
      phones: listDevices(room).filter((d) => d.role === 'phone').length,
      desktops: listDevices(room).filter((d) => d.role === 'desktop').length,
    },
    recentTransactions: room.transactions.slice(0, 8),
    recentNotifications: room.notifications.slice(0, 8),
  };
}

function upsertDevice(room, socket, meta = {}) {
  const device = {
    id: socket.id,
    role: socket.data.role || 'phone',
    deviceName: meta.deviceName || meta.name || defaultDeviceName(socket.data.role),
    platform: meta.platform || 'unknown',
    connectedAt: meta.connectedAt || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    online: true,
  };
  room.deviceMap.set(socket.id, device);
  return device;
}

function defaultDeviceName(role) {
  if (role === 'desktop') return 'Web Dashboard';
  return 'Zyro Phone';
}

io.on('connection', (socket) => {
  const pairing = normalizePairing(socket.handshake.query.pairing);
  const role = String(socket.handshake.query.role || 'phone').toLowerCase();
  const deviceName = String(socket.handshake.query.deviceName || '').trim();


  if (!pairing) {
    socket.emit('sync_error', {
      message: 'Pairing code is required (4–12 letters/numbers)',
    });
    socket.disconnect(true);
    return;
  }

  const roomKey = pairing;
  const room = getRoom(roomKey);
  const roomName = `pairing:${roomKey}`;
  socket.join(roomName);

  if (role === 'desktop') {
    room.desktops += 1;
  } else {
    room.phones += 1;
  }

  socket.data.pairing = roomKey;
  socket.data.role = role;
  socket.data.roomKey = roomKey;

  const device = upsertDevice(room, socket, {
    deviceName: deviceName || undefined,
    platform: role === 'desktop' ? 'web' : 'android',
  });

  socket.emit('sync_ready', {
    pairing: roomKey,
    role,
    serverTime: new Date().toISOString(),
  });
  socket.emit('history', room.transactions.slice(0, 50));
  socket.emit('notification_history', room.notifications.slice(0, 50));
  socket.emit('dashboard_update', buildDashboardPayload(room, roomKey));
  io.to(roomName).emit('presence', presencePayload(room));
  io.to(roomName).emit('device_joined', device);
  printConnectedDevices(roomKey);

  socket.on('register', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const updated = upsertDevice(room, socket, payload);
    updated.lastSeen = new Date().toISOString();
    room.deviceMap.set(socket.id, updated);
    io.to(roomName).emit('presence', presencePayload(room));
    io.to(roomName).emit('device_updated', updated);
    printConnectedDevices(roomKey);
  });

  socket.on('income_transaction', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    broadcastIncome(roomKey, payload);
    const dev = room.deviceMap.get(socket.id);
    if (dev) {
      dev.lastSeen = new Date().toISOString();
      room.deviceMap.set(socket.id, dev);
    }
  });

  socket.on('notification_event', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    broadcastNotification(roomKey, payload);
    const dev = room.deviceMap.get(socket.id);
    if (dev) {
      dev.lastSeen = new Date().toISOString();
      room.deviceMap.set(socket.id, dev);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.role === 'desktop') {
      room.desktops = Math.max(0, room.desktops - 1);
    } else {
      room.phones = Math.max(0, room.phones - 1);
    }
    const removed = room.deviceMap.get(socket.id);
    room.deviceMap.delete(socket.id);
    io.to(roomName).emit('presence', presencePayload(room));
    if (removed) {
      io.to(roomName).emit('device_left', { id: removed.id, role: removed.role });
    }
    io.to(roomName).emit('dashboard_update', buildDashboardPayload(room, roomKey));
    printConnectedDevices(roomKey);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  printStartupForApp();
});
