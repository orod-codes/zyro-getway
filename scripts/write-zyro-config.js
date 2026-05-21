'use strict';

const BANK_IDS = [
  'telebirr',
  'cbe',
  'awash',
  'dashen',
  'hibret',
  'coop',
  'abyssinia',
];
const EXPANDED_BANKS = new Set(['telebirr', 'cbe', 'awash']);

function q(value) {
  return `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatBank(id, banks, merchantName) {
  const b = banks[id] || {};
  const holder = String(b.holderName || merchantName || 'Demo Store PLC').trim();
  const enabled = b.enabled !== false;
  const account = String(b.accountNumber || '').trim();

  if (EXPANDED_BANKS.has(id) && enabled) {
    return `      ${id}: {
        enabled: true,
        accountNumber: ${q(account)},
        holderName: ${q(holder)},
      },`;
  }
  return `      ${id}: { enabled: false, accountNumber: '', holderName: ${q(holder)} },`;
}

/** Same layout as zyro.config.example.js (short header, single quotes, readable banks). */
function writeZyroConfig(config) {
  const c = config || {};
  const checkout = c.checkout || {};
  const banks = checkout.banks || {};
  const merchantName = String(checkout.merchantName || 'Demo Store PLC').trim();
  const gatewayPort = Number(c.port) || 3001;
  const checkoutPort = checkout.port != null ? Number(checkout.port) : null;

  let checkoutPortNote = '';
  if (Number.isFinite(checkoutPort) && checkoutPort > 0) {
    checkoutPortNote =
      '    /** Same as `port` above — or set only this to choose the port */\n' +
      `    port: ${checkoutPort},\n`;
  }

  const bankLines = BANK_IDS.map((id) => formatBank(id, banks, merchantName)).join(
    '\n',
  );

  return `/**
 * Edit then restart: npx zyro-gateway
 *
 * ip: ''  → auto LAN IP (terminal shows it)
 * port    → gateway + phone + checkout (one port)
 * checkout.orderApiUrl → customer name, photo, amount (not in this file)
 */

module.exports = {
  ip: ${q(c.ip ?? '')},
  port: ${gatewayPort},
  pairingCode: ${q(c.pairingCode || 'MYSTORE')},
  deviceName: ${q(c.deviceName || 'My Website')},
  autoConnect: ${c.autoConnect !== false},
  pollIntervalMs: ${Number(c.pollIntervalMs) || 1500},
  autoSave: ${c.autoSave !== false},
  dataFile: ${q(c.dataFile || 'zyro.data.js')},
  checkout: {
    merchantName: ${q(merchantName)},
${checkoutPortNote}    orderApiUrl: ${q(checkout.orderApiUrl || 'http://127.0.0.1:4000/api/orders/{orderId}')},
    orderIdParam: ${q(checkout.orderIdParam || 'orderId')},
    defaultOrderId: ${q(checkout.defaultOrderId ?? '')},
    banks: {
${bankLines}
    },
  },
};
`;
}

function deepMergeDefaults(target, defaults) {
  if (defaults == null || typeof defaults !== 'object' || Array.isArray(defaults)) {
    return target !== undefined ? target : defaults;
  }
  const out = { ...(target && typeof target === 'object' ? target : {}) };
  for (const key of Object.keys(defaults)) {
    if (key === 'banks' && defaults.banks && typeof defaults.banks === 'object') {
      out.banks = { ...defaults.banks };
      const userBanks = target?.banks && typeof target.banks === 'object' ? target.banks : {};
      for (const id of Object.keys(defaults.banks)) {
        out.banks[id] = { ...defaults.banks[id], ...(userBanks[id] || {}) };
      }
    } else if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      out[key] = deepMergeDefaults(out[key], defaults[key]);
      if (out[key] === undefined) out[key] = defaults[key];
    } else if (out[key] === undefined) {
      out[key] = defaults[key];
    }
  }
  return out;
}

function mergeWithExample(userConfig, exampleConfig) {
  const base = {
    ip: '',
    port: 3001,
    pairingCode: 'MYSTORE',
    deviceName: 'My Website',
    autoConnect: true,
    pollIntervalMs: 1500,
    autoSave: true,
    dataFile: 'zyro.data.js',
    checkout: exampleConfig.checkout,
  };
  const merged = deepMergeDefaults(userConfig, base);
  merged.checkout = deepMergeDefaults(userConfig?.checkout, exampleConfig.checkout);
  if (userConfig?.checkout?.port != null) {
    merged.checkout.port = userConfig.checkout.port;
  }
  if (!String(merged.checkout.orderApiUrl || '').trim()) {
    merged.checkout.orderApiUrl =
      exampleConfig.checkout?.orderApiUrl ||
      'http://127.0.0.1:4000/api/orders/{orderId}';
  }
  return merged;
}

module.exports = { writeZyroConfig, mergeWithExample, deepMergeDefaults };
