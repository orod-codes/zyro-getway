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
  /** Gateway port (phone app + website must match) */
  port: 3001,
  /** Same code in your phone app Setup → Zyro Gateway */
  pairingCode: 'MYSTORE',
  /** Label for web clients (optional) */
  deviceName: 'My Website',
  autoConnect: true,
  pollIntervalMs: 1500,
};
