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

const CONFIG_HEADER = `/**
 * Edit then restart: npx zyro-gateway
 *
 * ip: ''     → auto LAN IP (terminal shows it)
 * port       → gateway + phone + checkout (all one port)
 * checkout.port → if set, overrides port for everything
 */`;

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

/** Same layout as zyro.config.template.js */
function writeZyroConfig(config) {
  const c = config || {};
  const checkout = c.checkout || {};
  const banks = checkout.banks || {};
  const merchantName = String(checkout.merchantName || 'Demo Store PLC').trim();
  const gatewayPort = Number(c.port) || 3001;
  const checkoutPortRaw = checkout.port != null ? Number(checkout.port) : null;
  const checkoutPort =
    Number.isFinite(checkoutPortRaw) && checkoutPortRaw > 0
      ? checkoutPortRaw
      : gatewayPort;

  const bankLines = BANK_IDS.map((id) => formatBank(id, banks, merchantName)).join(
    '\n',
  );

  return `${CONFIG_HEADER}

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
    /** Same as \`port\` above — or set only this to choose the port */
    port: ${checkoutPort},
    orderApiUrl: ${q(checkout.orderApiUrl || 'http://127.0.0.1:4000/api/orders/{orderId}')},
    orderIdParam: ${q(checkout.orderIdParam || 'orderId')},
    defaultOrderId: ${q(checkout.defaultOrderId ?? 'ZY-9942')},
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

function mergeWithExample(userConfig, templateConfig) {
  const base = {
    ip: '',
    port: 3001,
    pairingCode: 'MYSTORE',
    deviceName: 'My Website',
    autoConnect: true,
    pollIntervalMs: 1500,
    autoSave: true,
    dataFile: 'zyro.data.js',
    checkout: templateConfig.checkout,
  };
  const merged = deepMergeDefaults(userConfig, base);
  merged.checkout = deepMergeDefaults(userConfig?.checkout, templateConfig.checkout);
  if (userConfig?.checkout?.port != null) {
    merged.checkout.port = userConfig.checkout.port;
  }
  if (!String(merged.checkout.orderApiUrl || '').trim()) {
    merged.checkout.orderApiUrl =
      templateConfig.checkout?.orderApiUrl ||
      'http://127.0.0.1:4000/api/orders/{orderId}';
  }
  if (merged.checkout.defaultOrderId === undefined || merged.checkout.defaultOrderId === '') {
    merged.checkout.defaultOrderId =
      userConfig?.checkout?.defaultOrderId ??
      templateConfig.checkout?.defaultOrderId ??
      'ZY-9942';
  }
  return merged;
}

module.exports = { writeZyroConfig, mergeWithExample, deepMergeDefaults };
