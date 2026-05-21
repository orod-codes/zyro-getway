'use strict';

/** Checkout UI bank ids — must match check-out/src/App payment method ids. */
const BANK_META = {
  telebirr: {
    name: 'Telebirr',
    logo: 'TeleBirr Logo.svg',
    providerLabel: 'Telebirr',
    phoneKeys: ['127', 'telebirr'],
  },
  cbe: {
    name: 'CBE',
    logo: 'Commercial Bank of Ethiopia Logo.svg',
    providerLabel: 'Commercial Bank of Ethiopia',
    phoneKeys: ['cbe', '999'],
  },
  awash: {
    name: 'Awash',
    logo: 'Awash International Bank Logo.svg',
    providerLabel: 'Awash International Bank',
    phoneKeys: ['awash'],
  },
  dashen: {
    name: 'Dashen',
    logo: 'Dashen Bank Logo.svg',
    providerLabel: 'Dashen Bank',
    phoneKeys: ['dashen'],
  },
  hibret: {
    name: 'Hibret',
    logo: 'Hibret Bank Logo.svg',
    providerLabel: 'Hibret Bank',
    phoneKeys: ['hibret'],
  },
  coop: {
    name: 'Coopbank',
    logo: 'Cooperative Bank of Oromia Logo.svg',
    providerLabel: 'Cooperative Bank of Oromia',
    phoneKeys: ['cbo', 'coop'],
  },
  abyssinia: {
    name: 'Abyssinia',
    logo: 'Bank of Abyssinia Logo.svg',
    providerLabel: 'Bank of Abyssinia',
    phoneKeys: ['boa', 'abyssinia'],
  },
};

const DEFAULT_CHECKOUT = {
  merchantName: 'Demo Store PLC',
  /** Your store/backend — checkout fetches customer + amount per orderId */
  orderApiUrl: '',
  orderIdParam: 'orderId',
  /** Dev only: used when opening /checkout/ with no ?orderId= (leave '' in production) */
  defaultOrderId: '',
  banks: {
    telebirr: {
      enabled: true,
      accountNumber: '0911 234 5678',
      holderName: 'Demo Store PLC',
    },
    cbe: {
      enabled: true,
      accountNumber: '1000123456789',
      holderName: 'Demo Store PLC',
    },
    awash: {
      enabled: true,
      accountNumber: '1000111222333',
      holderName: 'Demo Store PLC',
    },
    dashen: { enabled: false, accountNumber: '', holderName: 'Demo Store PLC' },
    hibret: { enabled: false, accountNumber: '', holderName: 'Demo Store PLC' },
    coop: { enabled: false, accountNumber: '', holderName: 'Demo Store PLC' },
    abyssinia: { enabled: false, accountNumber: '', holderName: 'Demo Store PLC' },
  },
};

function mergeCheckout(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_CHECKOUT));
  if (!raw || typeof raw !== 'object') return base;
  if (raw.merchantName) base.merchantName = String(raw.merchantName).trim();
  if (raw.orderApiUrl != null) base.orderApiUrl = String(raw.orderApiUrl).trim();
  if (raw.orderIdParam) base.orderIdParam = String(raw.orderIdParam).trim() || 'orderId';
  if (raw.defaultOrderId != null) {
    base.defaultOrderId = String(raw.defaultOrderId).trim();
  }
  if (raw.banks && typeof raw.banks === 'object') {
    for (const [id, entry] of Object.entries(raw.banks)) {
      if (!BANK_META[id] || !entry || typeof entry !== 'object') continue;
      base.banks[id] = {
        enabled: entry.enabled !== false,
        accountNumber: String(entry.accountNumber ?? base.banks[id]?.accountNumber ?? '').trim(),
        holderName: String(entry.holderName ?? raw.merchantName ?? base.merchantName).trim(),
      };
    }
  }
  return base;
}

function resolveCustomerPhotoUrl(name, url) {
  const trimmed = String(url || '').trim();
  if (trimmed) return trimmed;
  const safe = encodeURIComponent(String(name || 'Customer').trim() || 'Customer');
  return `https://ui-avatars.com/api/?name=${safe}&background=FF7A18&color=fff&size=128&bold=true`;
}

function buildCheckoutApiPayload(checkout, pairingCode, orderData) {
  const order = orderData && typeof orderData === 'object' ? orderData : {};
  const customerName = String(order.customerName || '').trim();
  const amountEtb = Number(order.amountEtb);
  const orderRef = String(order.orderRef || order.orderId || '').trim();
  const methods = [];
  const accounts = {};

  for (const [id, meta] of Object.entries(BANK_META)) {
    const row = checkout.banks[id];
    if (!row || row.enabled === false) continue;
    if (!row.accountNumber) continue;

    methods.push({
      id,
      name: meta.name,
      logo: `/checkout/bank-logo/${encodeURIComponent(meta.logo)}`,
      recommended: id === 'telebirr',
    });

    accounts[id] = {
      accountNumber: row.accountNumber,
      holderName: row.holderName || checkout.merchantName,
      providerLabel: meta.providerLabel,
    };
  }

  const hasOrder =
    customerName.length > 0 && Number.isFinite(amountEtb) && amountEtb > 0;

  return {
    ok: true,
    pairingCode: pairingCode || null,
    merchantName: checkout.merchantName,
    customerName,
    customerPhotoUrl: resolveCustomerPhotoUrl(customerName, order.customerPhotoUrl),
    amountEtb: hasOrder ? amountEtb : 0,
    orderRef,
    orderReady: hasOrder,
    orderApiUrl: checkout.orderApiUrl || null,
    paymentMethods: methods,
    accounts,
    phoneMonitorKeys: methods.flatMap((m) => BANK_META[m.id]?.phoneKeys || []),
    zyroScript: '/zyro/zyro.js',
  };
}

/** Does gateway income payload match checkout bank id? */
function incomeMatchesBankId(tx, bankId) {
  const meta = BANK_META[bankId];
  if (!meta) return false;
  const hay = `${tx.smsAddress || ''} ${tx.accountSource || ''} ${tx.sender || ''} ${tx.name || ''}`
    .toLowerCase();
  return meta.phoneKeys.some((k) => hay.includes(k.toLowerCase()));
}

module.exports = {
  BANK_META,
  DEFAULT_CHECKOUT,
  mergeCheckout,
  resolveCustomerPhotoUrl,
  buildCheckoutApiPayload,
  incomeMatchesBankId,
};
