#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { DATA_TEMPLATE } = require('../src/persistence/auto-save');

const root = path.join(__dirname, '..');
const example = path.join(root, 'zyro.config.example.js');
const cwd = process.cwd();
const configTarget = path.join(cwd, 'zyro.config.js');
const dataTarget = path.join(cwd, 'zyro.data.js');

let created = 0;

if (!fs.existsSync(configTarget)) {
  if (!fs.existsSync(example)) {
    console.error('Missing', example);
    process.exit(1);
  }
  fs.copyFileSync(example, configTarget);
  console.log('Created', configTarget);
  created += 1;
} else {
  console.log('Already exists:', configTarget);
}

if (!fs.existsSync(dataTarget)) {
  fs.writeFileSync(dataTarget, DATA_TEMPLATE, 'utf8');
  console.log('Created', dataTarget, '(incoming requests auto-save here)');
  created += 1;
} else {
  console.log('Already exists:', dataTarget);
}

if (created) {
  console.log('Edit ip, port, pairingCode in zyro.config.js then run: npx z-getway');
}
