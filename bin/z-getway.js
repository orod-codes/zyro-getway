#!/usr/bin/env node
'use strict';

const cmd = process.argv[2];

if (cmd === 'config' || cmd === 'init') {
  require('../scripts/init-config.js');
} else if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`
Zyro Gateway (z-getway)

Usage:
  z-getway              Start the gateway server
  z-getway config       Create zyro.config.js in the current directory
  z-getway help         Show this message

Update to latest:
  npm update z-getway
  npx z-getway@latest

Environment:
  PORT          Override listen port
  ZYRO_CONFIG   Path to zyro.config.js

Docs: https://github.com/orod-codes/zyro-getway#readme
`);
} else {
  require('../src/index').start();
}
