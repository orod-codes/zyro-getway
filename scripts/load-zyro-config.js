const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const DEFAULTS = {
  ip: '',
  port: 3000,
  pairingCode: '',
  deviceName: '',
  autoConnect: true,
  pollIntervalMs: 1500,
};

/**
 * Config search order:
 * 1. ZYRO_CONFIG env path
 * 2. ./zyro.config.js (cwd — npm start from your project)
 * 3. zyro.config.js next to server.js (package folder)
 */
function resolveConfigPath(packageDir) {
  if (process.env.ZYRO_CONFIG) {
    return path.resolve(process.env.ZYRO_CONFIG);
  }
  const cwdFile = path.join(process.cwd(), 'zyro.config.js');
  if (fs.existsSync(cwdFile)) return cwdFile;
  const pkgFile = path.join(packageDir, 'zyro.config.js');
  if (fs.existsSync(pkgFile)) return pkgFile;
  return cwdFile;
}

function parseExportDefault(text) {
  const out = { ...DEFAULTS };
  const ipMatch = text.match(/ip:\s*['"]([^'"]*)['"]/);
  const portMatch = text.match(/port:\s*(\d+)/);
  const pairingMatch = text.match(/pairingCode:\s*['"]([^'"]+)['"]/);
  const deviceMatch = text.match(/deviceName:\s*['"]([^'"]+)['"]/);
  const autoMatch = text.match(/autoConnect:\s*(true|false)/);
  const pollMatch = text.match(/pollIntervalMs:\s*(\d+)/);
  if (ipMatch) out.ip = ipMatch[1].trim();
  if (portMatch) out.port = Number(portMatch[1]);
  if (pairingMatch) out.pairingCode = pairingMatch[1].trim();
  if (deviceMatch) out.deviceName = deviceMatch[1].trim();
  if (autoMatch) out.autoConnect = autoMatch[1] === 'true';
  if (pollMatch) out.pollIntervalMs = Number(pollMatch[1]);
  return out;
}

function loadZyroConfig(packageDir) {
  const configPath = resolveConfigPath(packageDir);
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULTS, configPath, loaded: false };
  }

  const text = fs.readFileSync(configPath, 'utf8');
  let parsed = { ...DEFAULTS };

  try {
    if (/module\.exports\s*=/.test(text)) {
      const req = createRequire(configPath);
      const mod = req(configPath);
      parsed = { ...DEFAULTS, ...(mod?.default || mod) };
    } else {
      parsed = parseExportDefault(text);
    }
  } catch (_) {
    parsed = parseExportDefault(text);
  }

  return {
    ...parsed,
    configPath,
    loaded: true,
  };
}

module.exports = { loadZyroConfig, resolveConfigPath, DEFAULTS };
