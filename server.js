const http = require('http');
const path = require('path');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
/** Optional default — websites & phones should set their own pairing code. */
const DEFAULT_PAIRING = normalizePairing(process.env.PAIRING_CODE || '');

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
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }),
);

function normalizePairing(raw) {
  const p = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (p.length < 4 || p.length > 12) return null;
  return p;
}

/** Pairing from query, header, or optional server default. */
function resolvePairing(req) {
  return (
    normalizePairing(req.query?.pairing) ||
    normalizePairing(req.headers['x-pairing']) ||
    DEFAULT_PAIRING ||
    null
  );
}

function requirePairing(req, res) {
  const pairing = resolvePairing(req);
  if (!pairing) {
    res.status(400).json({
      ok: false,
      error: 'pairing required — set pairingCode in zyro.config.js or pass ?pairing= / X-Pairing',
    });
    return null;
  }
  return pairing;
}

app.get('/api/info', (req, res) => {
  const ip = getLocalIp();
  const requested = normalizePairing(req.query.pairing);
  res.json({
    pairingCode: requested || DEFAULT_PAIRING || null,
    suggestedPairingCode: DEFAULT_PAIRING || null,
    pairingRequired: true,
    port: PORT,
    wsUrl: `ws://${ip}:${PORT}`,
    httpUrl: `http://${ip}:${PORT}`,
    hostname: os.hostname(),
    features: ['transactions', 'notifications', 'dashboard', 'devices'],
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

app.post('/api/income', (req, res) => {
  const pairing = requirePairing(req, res);
  if (!pairing) return;
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid body' });
  }
  console.log(`[income-http] ${pairing}`);
  broadcastIncome(pairing, payload);
  bumpPhonePresence(pairing);
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
  bumpPhonePresence(pairing);
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

function broadcastIncome(roomKey, payload) {
  const room = getRoom(roomKey);
  const roomName = `pairing:${roomKey}`;
  const tx = { ...payload, receivedAt: new Date().toISOString() };
  room.transactions.unshift(tx);
  if (room.transactions.length > 500) room.transactions.length = 500;
  io.to(roomName).emit('income_transaction', tx);
  io.to(roomName).emit('dashboard_update', buildDashboardPayload(room, roomKey));
  const who = payload.name || payload.payerName || payload.sender || '?';
  const txn = payload.transactionNumber || payload.referenceNumber || '—';
  console.log(`[income] ${roomKey} ETB ${payload.amount} · ${who} · Txn ${txn}`);
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
  const src = note.source || note.channel || 'unknown';
  console.log(`[notification] ${roomKey} ${src} · ${String(note.preview || note.title || '').slice(0, 60)}`);
}

function bumpPhonePresence(roomKey) {
  const room = getRoom(roomKey);
  const roomName = `pairing:${roomKey}`;
  io.to(roomName).emit('presence', presencePayload(room));
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
  return {
    phones: room.phones,
    desktops: room.desktops,
    devices: listDevices(room),
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
      phones: room.phones,
      desktops: room.desktops,
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

  console.log(`[connect] ${role} pairing=${pairing || '(none)'} id=${socket.id}`);

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

  socket.on('register', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const updated = upsertDevice(room, socket, payload);
    updated.lastSeen = new Date().toISOString();
    room.deviceMap.set(socket.id, updated);
    console.log(`[register] ${role} room=${roomKey}`, updated.deviceName);
    io.to(roomName).emit('presence', presencePayload(room));
    io.to(roomName).emit('device_updated', updated);
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
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('');
  console.log('  Zyro Gateway');
  console.log('  ────────────────');
  console.log(`  URL          : http://${ip}:${PORT}`);
  if (DEFAULT_PAIRING) {
    console.log(`  Default code : ${DEFAULT_PAIRING} (optional — override in zyro.config.js)`);
  } else {
    console.log('  Pairing      : set pairingCode in zyro.config.js (your site + phone app)');
  }
  console.log('');
});

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
