#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { DATA_TEMPLATE } = require('../src/persistence/auto-save');
const { writeZyroConfig, mergeWithExample } = require('./write-zyro-config');

const root = path.join(__dirname, '..');
/** Shipped install template — same layout as project zyro.config.js */
const templatePath = path.join(root, 'zyro.config.template.js');
const cwd = process.cwd();
const configTarget = path.join(cwd, 'zyro.config.js');
const dataTarget = path.join(cwd, 'zyro.data.js');
const upgrade = process.argv.includes('--upgrade');

function loadTemplate() {
  if (!fs.existsSync(templatePath)) {
    console.error('Missing', templatePath);
    process.exit(1);
  }
  const req = createRequire(templatePath);
  return req(templatePath);
}

function loadUserConfig() {
  if (!fs.existsSync(configTarget)) return null;
  try {
    const req = createRequire(configTarget);
    return req(configTarget);
  } catch (err) {
    console.error('Could not read', configTarget, err.message);
    process.exit(1);
  }
}

function configNeedsUpgrade(text) {
  return (
    !text.includes('checkout:') ||
    !text.includes('orderApiUrl') ||
    !text.includes('dataFile') ||
    !text.includes('checkout.port → if set') ||
    !text.includes('Same as `port` above') ||
    text.includes('Zyro Gateway config — create or refresh') ||
    text.includes('checkout.orderApiUrl → customer name') ||
    /accountNumber: "/.test(text)
  );
}

let created = 0;

if (!fs.existsSync(configTarget)) {
  fs.copyFileSync(templatePath, configTarget);
  console.log('Created', configTarget);
  created += 1;
} else {
  const text = fs.readFileSync(configTarget, 'utf8');
  const stale = configNeedsUpgrade(text);
  if (upgrade || stale) {
    const template = loadTemplate();
    const user = loadUserConfig() || {};
    const merged = mergeWithExample(user, template);
    fs.writeFileSync(configTarget, writeZyroConfig(merged), 'utf8');
    console.log(
      upgrade ? 'Upgraded' : 'Updated config to match install template in',
      configTarget,
    );
    created += 1;
  } else {
    console.log('Already up to date:', configTarget);
    console.log('  Re-run with: npx zyro-gateway config --upgrade');
  }
}

if (!fs.existsSync(dataTarget)) {
  fs.writeFileSync(dataTarget, DATA_TEMPLATE, 'utf8');
  console.log('Created', dataTarget, '(incoming income auto-saves here)');
  created += 1;
} else {
  console.log('Already exists:', dataTarget);
}

if (created) {
  console.log('');
  console.log('Next: edit ip, port, pairingCode, checkout.orderApiUrl then run:');
  console.log('  npx zyro-gateway');
  console.log('Checkout: http://YOUR_IP:PORT/checkout/?orderId=...');
}
