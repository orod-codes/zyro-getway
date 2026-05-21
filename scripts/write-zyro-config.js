'use strict';

/** Serialize merged config to zyro.config.js (same shape as zyro.config.example.js). */
function writeZyroConfig(config) {
  const c = config;
  const banks = c.checkout?.banks || {};
  const bankLine = (id) => {
    const b = banks[id] || {};
    const en = b.enabled !== false;
    const holder =
      b.holderName || c.checkout?.merchantName || 'Demo Store PLC';
    return `      ${id}: { enabled: ${en}, accountNumber: ${JSON.stringify(String(b.accountNumber || ''))}, holderName: ${JSON.stringify(String(holder))} },`;
  };

  return `/**
 * Zyro Gateway config — create or refresh:
 *   npx zyro-gateway config
 *   npx zyro-gateway config --upgrade
 *
 * Loaded from (first match):
 *   1. ZYRO_CONFIG env path
 *   2. ./zyro.config.js in the directory you start the server from
 *   3. zyro.config.js next to this package
 *
 * ONE listen port: gateway API, phone app, and /checkout/ all use \`port\` below.
 * Customer name, photo, and amount come from checkout.orderApiUrl — not this file.
 */

module.exports = {
  /** PC LAN IP — leave '' to auto-detect (printed in terminal on start) */
  ip: ${JSON.stringify(String(c.ip ?? ''))},
  /** Gateway + phone + Express Checkout (single port) */
  port: ${Number(c.port) || 3001},
  /** Same code in phone app Settings → Zyro Gateway */
  pairingCode: ${JSON.stringify(String(c.pairingCode || 'MYSTORE'))},
  /** Label for web clients (optional) */
  deviceName: ${JSON.stringify(String(c.deviceName || 'My Website'))},
  autoConnect: ${c.autoConnect !== false},
  pollIntervalMs: ${Number(c.pollIntervalMs) || 1500},
  /** Incoming SMS/income rows → dataFile (includes paymentMethod per bank) */
  autoSave: ${c.autoSave !== false},
  dataFile: ${JSON.stringify(String(c.dataFile || 'zyro.data.js'))},

  /**
   * Express Checkout — bank accounts here only.
   * Send customers: http://YOUR_IP:PORT/checkout/?orderId=ORDER_123
   * orderApiUrl must return JSON: { customerName, customerPhotoUrl?, amountEtb, orderRef? }
   */
  checkout: {
    merchantName: ${JSON.stringify(String(c.checkout?.merchantName || 'Demo Store PLC'))},
    orderApiUrl: ${JSON.stringify(String(c.checkout?.orderApiUrl || ''))},
    orderIdParam: ${JSON.stringify(String(c.checkout?.orderIdParam || 'orderId'))},
    /** Dev only — opening /checkout/ without ?orderId= (use '' in production) */
    defaultOrderId: ${JSON.stringify(String(c.checkout?.defaultOrderId ?? ''))},
    banks: {
      ${bankLine('telebirr')}
      ${bankLine('cbe')}
      ${bankLine('awash')}
      ${bankLine('dashen')}
      ${bankLine('hibret')}
      ${bankLine('coop')}
      ${bankLine('abyssinia')}
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
  if (!String(merged.checkout.orderApiUrl || '').trim()) {
    merged.checkout.orderApiUrl =
      exampleConfig.checkout?.orderApiUrl ||
      'http://127.0.0.1:4000/api/orders/{orderId}';
  }
  return merged;
}

module.exports = { writeZyroConfig, mergeWithExample, deepMergeDefaults };
