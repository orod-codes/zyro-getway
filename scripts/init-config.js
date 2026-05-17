#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const example = path.join(root, 'zyro.config.example.js');
const target = path.join(process.cwd(), 'zyro.config.js');

if (fs.existsSync(target)) {
  console.log('Already exists:', target);
  process.exit(0);
}

if (!fs.existsSync(example)) {
  console.error('Missing', example);
  process.exit(1);
}

fs.copyFileSync(example, target);
console.log('Created', target);
console.log('Edit ip, port, pairingCode then run: npx z-getway');
