/**
 * Edit then restart: npx zyro-gateway
 *
 * ip: ''     → auto LAN IP (terminal shows it)
 * port       → gateway + phone + checkout (all one port)
 * checkout.port → if set, overrides port for everything
 */

module.exports = {
  ip: '',
  port: 3001,
  pairingCode: 'MYSTORE',
  deviceName: 'My Website',
  autoConnect: true,
  pollIntervalMs: 1500,
  autoSave: true,
  dataFile: 'zyro.data.js',
  checkout: {
    merchantName: 'Demo Store PLC',
    /** Same as `port` above — or set only this to choose the port */
    port: 3001,
    orderApiUrl: 'http://127.0.0.1:4000/api/orders/{orderId}',
    orderIdParam: 'orderId',
    defaultOrderId: 'ZY-9942',
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
