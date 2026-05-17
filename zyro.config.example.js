/**
 * Zyro Gateway config — copy to your project root:
 *   npm run config
 * or:
 *   cp node_modules/zyro/zyro.config.example.js ./zyro.config.js
 *
 * Server reads ./zyro.config.js first (cwd), then package folder.
 */

export default {
  /** PC LAN IP — leave '' to auto-detect (shown in terminal on npm start) */
  ip: '',
  /** Gateway port (phone app + website must match) */
  port: 3001,
  /** Same code in Flutter Setup → Zyro Gateway */
  pairingCode: 'MYSTORE',
  /** Label for web clients (optional) */
  deviceName: 'My Website',
  autoConnect: true,
  pollIntervalMs: 1500,
};
