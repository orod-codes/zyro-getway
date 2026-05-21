'use strict';

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { incomeToTemplate, recordKey, formatDataFile } = require('./record');

const DATA_TEMPLATE = `/**
 * Zyro Gateway — incoming income (auto-saved when autoSave: true)
 *
 * Each row: name, sender, amount, transactionNumber, time,
 *           paymentMethod (telebirr | cbe | awash | …), paymentMethodName
 */
module.exports = [
];
`;

function resolveDataPath(configPath, dataFile) {
  const name = String(dataFile || 'zyro.data.js').trim();
  if (!name) return null;
  const base = configPath ? path.dirname(configPath) : process.cwd();
  return path.isAbsolute(name) ? name : path.join(base, name);
}

function parseTransactionsFromFile(mod) {
  const parsed = mod?.default ?? mod;
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.rooms && typeof parsed.rooms === 'object') {
    const all = [];
    for (const room of Object.values(parsed.rooms)) {
      if (Array.isArray(room.transactions)) all.push(...room.transactions);
    }
    return all.map((tx) => incomeToTemplate(tx));
  }
  if (Array.isArray(parsed?.transactions)) return parsed.transactions;
  return [];
}

function createAutoSave(options = {}) {
  const { dataPath, enabled = true } = options;

  if (!enabled || !dataPath) {
    return {
      dataPath: null,
      loadIntoRooms() {},
      saveTransaction() {},
      saveNotification() {},
    };
  }

  /** @type {Array<{name,sender,amount,transactionNumber,time,paymentMethod,paymentMethodName}>} */
  let transactions = [];
  let writeTimer = null;

  function ensureFile() {
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(path.dirname(dataPath), { recursive: true });
      fs.writeFileSync(dataPath, DATA_TEMPLATE, 'utf8');
    }
  }

  function readStateFromDisk() {
    ensureFile();
    try {
      const req = createRequire(dataPath);
      transactions = parseTransactionsFromFile(req(dataPath));
    } catch {
      transactions = [];
    }
  }

  function flush() {
    writeTimer = null;
    fs.writeFileSync(dataPath, formatDataFile(transactions), 'utf8');
    try {
      const resolved = path.resolve(dataPath);
      if (require.cache[resolved]) delete require.cache[resolved];
    } catch (_) {
      /* ignore */
    }
  }

  function scheduleWrite() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(flush, 80);
  }

  function cap(list, max) {
    if (list.length > max) list.length = max;
  }

  function loadIntoRooms(getRoom, defaultPairing) {
    readStateFromDisk();
    const key = String(defaultPairing || '').toUpperCase();
    if (!key) return;
    const room = getRoom(key);
    const seen = new Set(room.transactions.map((t) => recordKey(incomeToTemplate(t))));
    for (const row of transactions) {
      const id = recordKey(row);
      if (seen.has(id)) continue;
      room.transactions.push({
        ...row,
        receivedAt: row.time,
        timestamp: row.time,
        accountSource: row.paymentMethodName,
        smsAddress: row.sender,
      });
      seen.add(id);
    }
    room.transactions.sort((a, b) =>
      String(b.receivedAt || b.time || '').localeCompare(
        String(a.receivedAt || a.time || ''),
      ),
    );
    cap(room.transactions, 500);
  }

  function saveTransaction(_roomKey, payload) {
    const row = incomeToTemplate(payload);
    const id = recordKey(row);
    if (!transactions.some((t) => recordKey(t) === id)) {
      transactions.unshift(row);
    }
    cap(transactions, 500);
    scheduleWrite();
  }

  function saveNotification() {
    /* income file only — notifications stay in memory */
  }

  readStateFromDisk();

  return {
    dataPath,
    loadIntoRooms,
    saveTransaction,
    saveNotification,
    flush,
  };
}

module.exports = { createAutoSave, resolveDataPath, DATA_TEMPLATE };
