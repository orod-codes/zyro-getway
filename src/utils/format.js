'use strict';

const { detectPaymentMethod } = require('../persistence/record');

function formatEtb(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '— ETB';
  return `${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

function incomeDisplayFields(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const name =
    String(p.name || p.payerName || p.sender || 'Unknown').trim() || 'Unknown';
  const amount = formatEtb(p.amount);
  const sender =
    String(p.smsAddress || p.accountSource || p.sender || '—').trim() || '—';
  const txn =
    String(
      p.transactionNumber || p.referenceNumber || p.transactionId || '—',
    ).trim() || '—';
  const { paymentMethodName } = detectPaymentMethod(p);
  return { name, amount, sender, txn, bank: paymentMethodName };
}

module.exports = { formatEtb, incomeDisplayFields };
