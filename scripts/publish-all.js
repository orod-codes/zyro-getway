#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const original = fs.readFileSync(pkgPath, 'utf8');
const base = JSON.parse(original);

const otp =
  process.env.NPM_OTP ||
  process.argv.find((a) => a.startsWith('--otp='))?.split('=').slice(1).join('=');

function npmWhoami() {
  try {
    return execSync('npm whoami', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function bumpPatch(version) {
  const parts = String(version || '0.0.0').split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

function nextVersion(packageName) {
  try {
    const latest = execSync(`npm view ${packageName} version`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return bumpPatch(latest);
  } catch {
    return '1.0.0';
  }
}

const user = npmWhoami();

if (!user && (!otp || !/^\d{6,8}$/.test(otp))) {
  console.error(`
Not logged in to npm.

  npm login
  npm run release

Or: npm run release -- --otp=123456
`);
  process.exit(1);
}

if (user) console.log(`npm user: ${user}`);

const targets = [
  { name: 'z-getway', version: nextVersion('z-getway') },
  { name: 'zyro-gateway', version: nextVersion('zyro-gateway') },
];

console.log(
  'Will publish:',
  targets.map((t) => `${t.name}@${t.version}`).join(', '),
);

function publishPackage(name, version) {
  const publishPkg = { ...base, name, version };
  fs.writeFileSync(pkgPath, JSON.stringify(publishPkg, null, 2) + '\n');

  const env = { ...process.env };
  if (otp) env.NPM_CONFIG_OTP = otp;

  execSync('npm publish --access public', {
    cwd: root,
    stdio: 'inherit',
    env,
  });
}

console.log('Building SDK + Express Checkout…');
execSync('npm run build:all', { cwd: root, stdio: 'inherit' });

for (const { name, version } of targets) {
  console.log(`\nPublishing ${name}@${version}…`);
  try {
    publishPackage(name, version);
    console.log(`✓ ${name}@${version}`);
  } catch {
    fs.writeFileSync(pkgPath, original);
    console.error(`\n✗ Failed ${name}@${version}`);
    process.exit(1);
  }
}

const zGetwayVersion = targets.find((t) => t.name === 'z-getway').version;
fs.writeFileSync(
  pkgPath,
  JSON.stringify({ ...base, name: 'z-getway', version: zGetwayVersion }, null, 2) + '\n',
);
console.log(`\nDone. package.json → z-getway@${zGetwayVersion}`);
