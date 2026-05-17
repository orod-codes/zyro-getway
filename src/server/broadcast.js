'use strict';

const { getRoom, buildDashboardPayload } = require('./rooms');
const { printIncome } = require('./terminal');
const { touchHttpPhone } = require('./devices');

function createBroadcaster(io) {
  function broadcastIncome(roomKey, payload) {
    const room = getRoom(roomKey);
    const roomName = `pairing:${roomKey}`;
    const tx = { ...payload, receivedAt: new Date().toISOString() };
    room.transactions.unshift(tx);
    if (room.transactions.length > 500) room.transactions.length = 500;
    printIncome(roomKey, tx);
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
    if (!note.id) {
      note.id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    room.notifications.unshift(note);
    if (room.notifications.length > 200) room.notifications.length = 200;
    io.to(roomName).emit('notification_event', note);
    io.to(roomName).emit('dashboard_update', buildDashboardPayload(room, roomKey));
  }

  function bumpPhonePresence(roomKey, meta = {}) {
    touchHttpPhone(io, roomKey, meta);
  }

  return { broadcastIncome, broadcastNotification, bumpPhonePresence };
}

module.exports = { createBroadcaster };
