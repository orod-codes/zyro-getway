'use strict';

const {
  getRoom,
  presencePayload,
  buildDashboardPayload,
  listDevices,
} = require('./rooms');
const { normalizePairing } = require('../config/pairing');
const { upsertDevice } = require('./devices');
const { printConnectedDevices } = require('./terminal');

function attachSocketHandlers(io, ctx) {
  const { broadcaster } = ctx;

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
    printConnectedDevices(roomKey, listDevices(room));

    socket.on('register', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const updated = upsertDevice(room, socket, payload);
      updated.lastSeen = new Date().toISOString();
      room.deviceMap.set(socket.id, updated);
      io.to(roomName).emit('presence', presencePayload(room));
      io.to(roomName).emit('device_updated', updated);
      printConnectedDevices(roomKey, listDevices(room));
    });

    socket.on('income_transaction', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      broadcaster.broadcastIncome(roomKey, payload);
      const dev = room.deviceMap.get(socket.id);
      if (dev) {
        dev.lastSeen = new Date().toISOString();
        room.deviceMap.set(socket.id, dev);
      }
    });

    socket.on('notification_event', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      broadcaster.broadcastNotification(roomKey, payload);
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
        io.to(roomName).emit('device_left', {
          id: removed.id,
          role: removed.role,
        });
      }
      io.to(roomName).emit(
        'dashboard_update',
        buildDashboardPayload(room, roomKey),
      );
      printConnectedDevices(roomKey, listDevices(room));
    });
  });
}

module.exports = { attachSocketHandlers };
