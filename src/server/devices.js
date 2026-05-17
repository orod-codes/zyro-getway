'use strict';

const { getRoom, listDevices, presencePayload } = require('./rooms');
const { printConnectedDevices } = require('./terminal');

function defaultDeviceName(role) {
  if (role === 'desktop') return 'Web Dashboard';
  return 'Zyro Phone';
}

function upsertDevice(room, socket, meta = {}) {
  const device = {
    id: socket.id,
    role: socket.data.role || 'phone',
    deviceName:
      meta.deviceName || meta.name || defaultDeviceName(socket.data.role),
    platform: meta.platform || 'unknown',
    connectedAt: meta.connectedAt || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    online: true,
  };
  room.deviceMap.set(socket.id, device);
  return device;
}

function touchHttpPhone(io, roomKey, meta = {}) {
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
  printConnectedDevices(roomKey, listDevices(room));
  return device;
}

module.exports = { defaultDeviceName, upsertDevice, touchHttpPhone };
