'use strict';

const path = require('path');
const os = require('os');
const { getRoom, listDevices, buildDashboardPayload } = require('./rooms');
const { resolvePairing } = require('../config/pairing');
const { touchHttpPhone } = require('./devices');
const {
  buildCheckoutApiPayload,
  resolveCheckoutPort,
} = require('../config/checkout-config');
const { resolveOrderData, pickOrderId } = require('../config/checkout-order-fetch');

function registerRoutes(app, ctx) {
  const {
    zyroConfig,
    configPath,
    port,
    configPairing,
    publicIp,
    io,
    broadcaster,
  } = ctx;

  function serverConfigPayload() {
    return {
      ip: publicIp(),
      port,
      pairingCode: configPairing || null,
      configFile: path.basename(configPath),
      configPath,
      configLoaded: zyroConfig.loaded,
      configureInZyroConfigJs: ['ip', 'port', 'pairingCode', 'deviceName'],
    };
  }

  function serverPublicInfo() {
    const ip = publicIp();
    return {
      name: 'Zyro Gateway',
      mode: 'terminal',
      ...serverConfigPayload(),
      httpUrl: `http://${ip}:${port}`,
      wsUrl: `ws://${ip}:${port}`,
      hostname: os.hostname(),
      pairingCode: configPairing || null,
      pairingNote:
        'Edit ip, port, pairingCode in zyro.config.js then restart the gateway.',
    };
  }

  function requirePairing(req, res) {
    const pairing = resolvePairing(req, configPairing);
    if (!pairing) {
      res.status(400).json({
        ok: false,
        error: 'pairing required — set pairingCode in zyro.config.js',
      });
      return null;
    }
    return pairing;
  }

  app.get('/', (_req, res) => {
    res.json({
      ...serverPublicInfo(),
      endpoints: [
        '/api/config',
        '/api/info',
        '/api/register',
        '/api/transactions',
        '/api/notifications',
        '/api/dashboard',
        '/api/devices',
        '/api/checkout-config',
      ],
      clientScript: '/zyro/zyro.js',
      checkoutUrl: '/checkout/',
    });
  });

  app.get('/api/checkout-config', async (req, res) => {
    const checkout = zyroConfig.checkout;
    const q = { ...(req.query || {}) };
    const idKey = checkout?.orderIdParam || 'orderId';
    let orderId = pickOrderId(q, idKey);
    const needsApi = Boolean(String(checkout?.orderApiUrl || '').trim());

    if (!orderId && checkout?.defaultOrderId) {
      orderId = String(checkout.defaultOrderId).trim();
      q[idKey] = orderId;
    }

    try {
      const orderData = await resolveOrderData(checkout, q);
      if (needsApi && orderId && !orderData) {
        res.status(502).json({
          ok: false,
          error: 'Could not load order from your main system',
        });
        return;
      }
      if (needsApi && !orderId && !orderData) {
        res.status(400).json({
          ok: false,
          error:
            'Missing orderId — your store should open /checkout/?orderId=YOUR_ORDER_ID (or set checkout.defaultOrderId for local testing)',
        });
        return;
      }
      const ip = publicIp();
      const checkoutPort = resolveCheckoutPort(checkout, port);
      res.json(
        buildCheckoutApiPayload(checkout, configPairing, orderData, {
          ip,
          gatewayPort: port,
          checkoutPort,
        }),
      );
    } catch (err) {
      res.status(err.status && err.status >= 400 ? err.status : 502).json({
        ok: false,
        error: err.message || 'Main system order fetch failed',
      });
    }
  });

  app.get('/api/config', (_req, res) => {
    res.json(serverConfigPayload());
  });

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
      list = list.filter(
        (n) => String(n.receivedAt || n.timestamp || '') > after,
      );
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
    const device = touchHttpPhone(io, pairing, {
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
    broadcaster.broadcastIncome(pairing, payload);
    broadcaster.bumpPhonePresence(pairing, {
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
    broadcaster.broadcastNotification(pairing, payload);
    broadcaster.bumpPhonePresence(pairing, {
      deviceName: payload.title || payload.appName,
      platform: 'android',
    });
    res.json({ ok: true, pairing });
  });

  ctx.serverPublicInfo = serverPublicInfo;
}

module.exports = { registerRoutes };
