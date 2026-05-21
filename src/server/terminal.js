'use strict';

const { incomeDisplayFields } = require('../utils/format');

const _connectedPrintKey = new Map();

function printStartup({
  configPath,
  configLoaded,
  pairing,
  ip,
  port,
  dataPath,
  autoSave,
  checkoutReady,
}) {
  console.log('');
  console.log('  Zyro Gateway');
  console.log('  ───────────────────────');
  console.log(
    `  Config    ${configPath}${configLoaded ? '' : ' (missing — run: npx zyro-gateway config)'}`,
  );
  console.log(`  Pairing   ${pairing || '— set pairingCode in zyro.config.js'}`);
  console.log(`  App       IP ${ip}   port ${port}`);
  if (autoSave && dataPath) {
    console.log(`  Auto-save ${dataPath}`);
  }
  if (checkoutReady) {
    console.log(`  Checkout  http://${ip}:${port}/checkout/`);
    console.log(`            one port — set port in zyro.config.js`);
  }
  console.log('');
  console.log('  Connected: (waiting…)');
  console.log('  Income:    name · amount · sender · ref');
  console.log('');
}

function printConnectedDevices(roomKey, devices) {
  const fingerprint =
    devices.map((d) => `${d.role}:${d.deviceName}`).join('|') || '(none)';
  if (_connectedPrintKey.get(roomKey) === fingerprint) return;
  _connectedPrintKey.set(roomKey, fingerprint);

  console.log(`  Connected [${roomKey}]:`);
  if (devices.length === 0) {
    console.log('    (none)');
  } else {
    for (const d of devices) {
      const icon = d.role === 'phone' ? '📱' : '🖥️';
      const via = d.via === 'http' ? ' · HTTP' : '';
      console.log(`    ${icon} ${d.deviceName}${via}`);
    }
  }
  console.log('');
}

function printIncome(roomKey, payload) {
  const { name, amount, sender, txn, bank } = incomeDisplayFields(payload);
  console.log(`  Income [${roomKey}]`);
  console.log(`    ${amount}  ·  ${name}`);
  console.log(`    ${bank}  ·  Sender ${sender}  ·  Ref ${txn}`);
  console.log('');
}

module.exports = { printStartup, printConnectedDevices, printIncome };
