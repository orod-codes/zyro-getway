/**
 * Zyro Gateway config — create or refresh:
 *   npx zyro-gateway config
 *   npx zyro-gateway config --upgrade
 *
 * Loaded from (first match):
 *   1. ZYRO_CONFIG env path
 *   2. ./zyro.config.js in the directory you start the server from
 *   3. zyro.config.js next to this package
 *
 * ONE listen port: gateway API, phone app, and /checkout/ all use `port` below.
 * Customer name, photo, and amount come from checkout.orderApiUrl — not this file.
 */

module.exports = {
  /** PC LAN IP — leave '' to auto-detect (printed in terminal on start) */
  ip: '',
  /** Gateway + phone + Express Checkout (single port) */
  port: 3001,
  /** Same code in phone app Settings → Zyro Gateway */
  pairingCode: 'MYSTORE',
  /** Label for web clients (optional) */
  deviceName: 'My Website',
  autoConnect: true,
  pollIntervalMs: 1500,
  /** Incoming SMS/income rows → dataFile (includes paymentMethod per bank) */
  autoSave: true,
  dataFile: 'zyro.data.js',

  /**
   * Express Checkout — bank accounts here only.
   * Send customers: http://YOUR_IP:PORT/checkout/?orderId=ORDER_123
   * orderApiUrl must return JSON: { customerName, customerPhotoUrl?, amountEtb, orderRef? }
   */
  checkout: {
    merchantName: 'Demo Store PLC',
    orderApiUrl: 'http://127.0.0.1:4000/api/orders/{orderId}',
    orderIdParam: 'orderId',
    /** Dev only — opening /checkout/ without ?orderId= (use '' in production) */
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
  },
};
