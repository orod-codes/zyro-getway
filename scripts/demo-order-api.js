#!/usr/bin/env node
'use strict';

/**
 * Tiny demo of the "main system" API checkout calls.
 * Run: node scripts/demo-order-api.js
 * Set zyro.config.js orderApiUrl to http://127.0.0.1:4000/api/orders/{orderId}
 * Open: http://YOUR_IP:3001/checkout/?orderId=ZY-9942
 */

const http = require('http');

const ORDERS = {
  'ZY-9942': {
    customerName: 'Abebe Kebede',
    customerPhotoUrl: '',
    amountEtb: 2850,
    orderRef: 'ZY-9942',
  },
  'ORD-100': {
    customerName: 'Sara Tadesse',
    customerPhotoUrl: 'https://i.pravatar.cc/128?u=sara',
    amountEtb: 1200,
    orderRef: 'ORD-100',
  },
};

const server = http.createServer((req, res) => {
  const m = req.url.match(/^\/api\/orders\/([^/?]+)/);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (!m) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  const row = ORDERS[decodeURIComponent(m[1])];
  if (!row) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'order not found' }));
    return;
  }
  res.end(JSON.stringify(row));
});

server.listen(4000, '127.0.0.1', () => {
  console.log('Demo main system: http://127.0.0.1:4000/api/orders/{orderId}');
  console.log('Try orderIds:', Object.keys(ORDERS).join(', '));
});
