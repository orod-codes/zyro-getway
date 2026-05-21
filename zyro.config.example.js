/**
 * Zyro Gateway config — create in your project:
 *   npx zyro-gateway config
 *
 * Loaded from (first match):
 *   1. ZYRO_CONFIG env path
 *   2. ./zyro.config.js in the directory you start the server from
 *   3. zyro.config.js next to this package
 */

module.exports = {
  /** PC LAN IP — leave '' to auto-detect (shown in terminal on start) */
  ip: '',
  /** Gateway + phone + checkout (use one port) */
  port: 3001,
  /** Same code in phone app Settings → Zyro Gateway */
  pairingCode: 'MYSTORE',
  /** Label for web clients (optional) */
  deviceName: 'My Website',
  autoConnect: true,
  pollIntervalMs: 1500,
  autoSave: true,
  dataFile: 'zyro.data.js',

  /**
   * Express Checkout — banks/accounts here; customer + amount from your main system API.
   * Send users to: http://YOUR_IP:PORT/checkout/?orderId=ORDER_123
   * orderApiUrl must return JSON: { customerName, customerPhotoUrl?, amountEtb, orderRef? }
   */
  checkout: {
    merchantName: 'Demo Store PLC',
    /** Optional — overrides top-level `port` when set */
    // port: 3001,
    orderApiUrl: 'http://127.0.0.1:4000/api/orders/{orderId}',
    orderIdParam: 'orderId',
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
