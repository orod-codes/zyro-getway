#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const checkoutDir = path.join(root, 'check-out');
const assets = path.join(root, 'assets');
const publicDir = path.join(checkoutDir, 'public');

if (!fs.existsSync(checkoutDir)) {
  console.error('Missing check-out/ folder');
  process.exit(1);
}

function copyLogo() {
  fs.mkdirSync(publicDir, { recursive: true });
  const candidates = [
    path.join(assets, 'zyro-logo.png'),
    path.join(root, '..', 'assets', 'images', 'zyro_logo.png'),
    path.join(checkoutDir, 'public', 'zyro-logo.png'),
  ];
  const dst = path.join(publicDir, 'zyro-logo.png');
  for (const src of candidates) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log('Logo copied to check-out/public/zyro-logo.png');
      return;
    }
  }
  console.warn('Warning: zyro-logo.png not found — add zyrogetway/assets/zyro-logo.png');
}

copyLogo();

const checkoutModules = path.join(checkoutDir, 'node_modules');
if (!fs.existsSync(checkoutModules)) {
  console.log('Installing checkout UI dependencies…');
  execSync('npm install', { cwd: checkoutDir, stdio: 'inherit' });
}

console.log('Building Express Checkout…');
execSync('npm run build', { cwd: checkoutDir, stdio: 'inherit' });
console.log('Checkout ready at /checkout/ when gateway runs.');
