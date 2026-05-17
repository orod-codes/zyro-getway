'use strict';

/** @type {Map<string, object>} */
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
  const todayTotal = todayTx.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0,
  );
  const matchedNotes = room.notifications.filter((n) => n.matched).length;
  const devices = listDevices(room);

  return {
    serverTime: new Date().toISOString(),
    pairingCode: roomKey,
    stats: {
      todayTotal,
      transactionCount: room.transactions.length,
      todayTransactionCount: todayTx.length,
      notificationCount: room.notifications.length,
      matchedNotificationCount: matchedNotes,
      phones: devices.filter((d) => d.role === 'phone').length,
      desktops: devices.filter((d) => d.role === 'desktop').length,
    },
    recentTransactions: room.transactions.slice(0, 8),
    recentNotifications: room.notifications.slice(0, 8),
  };
}

module.exports = {
  getRoom,
  listDevices,
  presencePayload,
  buildDashboardPayload,
};
