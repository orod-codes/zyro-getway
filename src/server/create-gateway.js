'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { loadZyroConfig } = require('../config/load-config');
const { normalizePairing } = require('../config/pairing');
const { getLocalIp } = require('../utils/network');
const { createBroadcaster } = require('./broadcast');
const { registerRoutes } = require('./routes');
const { attachSocketHandlers } = require('./socket');
const { printStartup } = require('./terminal');
const { createAutoSave, resolveDataPath } = require('../persistence/auto-save');
const { getRoom } = require('./rooms');

/**
 * Create an Express + Socket.IO gateway instance (does not listen until `.start()`).
 * @param {{ packageRoot?: string }} [options]
 */
function createGateway(options = {}) {
  const packageRoot =
    options.packageRoot || path.join(__dirname, '../..');
  const zyroConfig = loadZyroConfig(packageRoot);
  const configPath = zyroConfig.configPath;
  const envPort = process.env.PORT ? Number(process.env.PORT) : null;
  const port =
    (Number.isFinite(envPort) && envPort > 0 ? envPort : null) ??
    zyroConfig.port ??
    3000;
  const configPairing = normalizePairing(zyroConfig.pairingCode) || '';

  function publicIp() {
    return zyroConfig.ip || getLocalIp();
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
  const checkoutDist = path.join(packageRoot, 'check-out', 'dist');
  const logoAsset = path.join(packageRoot, 'assets', 'zyro-logo.png');
  if (fs.existsSync(checkoutDist)) {
    // Only /checkout (no slash) — Express also matches /checkout/ on this route; skip that or loop.
    app.get('/checkout', (req, res, next) => {
      if (req.path !== '/checkout') return next();
      const qs = new URLSearchParams(req.query || {}).toString();
      res.redirect(301, qs ? `/checkout/?${qs}` : '/checkout/');
    });
    app.use(
      '/checkout',
      express.static(checkoutDist, {
        index: 'index.html',
        redirect: false,
      }),
    );
  }
  if (fs.existsSync(logoAsset)) {
    app.get('/checkout/zyro-logo.png', (_req, res) => {
      res.sendFile(logoAsset);
    });
  }

  app.use(
    '/zyro',
    express.static(path.join(packageRoot, 'dist'), {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.js')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    }),
  );

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['polling', 'websocket'],
    pingTimeout: 120000,
    pingInterval: 25000,
    connectTimeout: 60000,
    allowEIO3: true,
  });

  const dataPath = resolveDataPath(configPath, zyroConfig.dataFile);
  const autoSave = createAutoSave({
    dataPath,
    enabled: zyroConfig.autoSave !== false,
  });
  autoSave.loadIntoRooms(getRoom, configPairing);

  const broadcaster = createBroadcaster(io, autoSave);
  const ctx = {
    packageRoot,
    zyroConfig,
    configPath,
    port,
    configPairing,
    publicIp,
    io,
    broadcaster,
    autoSave,
  };

  registerRoutes(app, ctx);
  attachSocketHandlers(io, ctx);

  return {
    app,
    server,
    io,
    config: zyroConfig,
    port,
    pairingCode: configPairing,
    publicIp,
    /**
     * @param {{ host?: string }} [listenOptions]
     * @returns {Promise<{ url: string, port: number, pairingCode: string }>}
     */
    start(listenOptions = {}) {
      const host = listenOptions.host ?? '0.0.0.0';
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeListener('error', reject);
          const ip = publicIp();
          printStartup({
            configPath,
            configLoaded: zyroConfig.loaded,
            pairing: configPairing,
            ip,
            port,
            dataPath: autoSave.dataPath,
            autoSave: zyroConfig.autoSave !== false,
            checkoutReady: fs.existsSync(checkoutDist),
          });
          resolve({
            url: `http://${ip}:${port}`,
            port,
            pairingCode: configPairing,
          });
        });
      });
    },
    stop() {
      return new Promise((resolve, reject) => {
        io.close();
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

module.exports = { createGateway };
