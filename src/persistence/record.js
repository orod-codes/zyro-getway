'use strict';

/** Only these fields are written to zyro.data.js */
function incomeToTemplate(payload) {
  const raw =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};

  const name = String(
    raw.name || raw.payerName || raw.customerName || '',
  ).trim();

  const sender = String(
    raw.sender || raw.smsAddress || raw.from || '',
  ).trim();

  const amount = Number(raw.amount);
  const transactionNumber = String(
    raw.transactionNumber ||
      raw.referenceNumber ||
      raw.transactionId ||
      raw.ref ||
      '',
  ).trim();

  const time = String(
    raw.timestamp || raw.receivedAt || new Date().toISOString(),
  );

  return {
    name: name || '—',
    sender: sender || '—',
    amount: Number.isFinite(amount) ? amount : 0,
    transactionNumber: transactionNumber || '—',
    time,
  };
}

function recordKey(tx) {
  return `${tx.transactionNumber}|${tx.time}|${tx.amount}|${tx.sender}`;
}

function formatDataFile(transactions) {
  const lines = transactions.map((tx) => {
    return `  {
    name: ${JSON.stringify(tx.name)},
    sender: ${JSON.stringify(tx.sender)},
    amount: ${tx.amount},
    transactionNumber: ${JSON.stringify(tx.transactionNumber)},
    time: ${JSON.stringify(tx.time)},
  }`;
  });
  const list = lines.length ? lines.join(',\n') : '';
  return `/**
 * Zyro Gateway — incoming income (auto-saved)
 */
module.exports = [
${list}
];
`;
}

module.exports = { incomeToTemplate, recordKey, formatDataFile };
