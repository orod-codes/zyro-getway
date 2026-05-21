#!/usr/bin/env node
'use strict';

const cmd = process.argv[2];

if (cmd === 'config' || cmd === 'init') {
  require('../scripts/init-config.js');
} else if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`
Zyro Gateway — real-time phone ↔ desktop sync

Usage:
  zyro-gateway              Start gateway + Express Checkout (/checkout/)
  zyro-gateway config       Create zyro.config.js + zyro.data.js
  zyro-gateway config --upgrade   Merge missing checkout fields into existing config
  zyro-gateway help         Show this message

Checkout: http://YOUR_IP:PORT/checkout/?orderId=...  (see SETUP.md)

Environment:
  PORT          Override listen port
  ZYRO_CONFIG   Path to zyro.config.js

Update: npm update z-getway  |  npx z-getway@latest

Docs: https://github.com/orod-codes/zyro-getway#readme
`);
} else {
  require('../src/index').start();
}
