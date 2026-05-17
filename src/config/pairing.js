'use strict';

function normalizePairing(raw) {
  const p = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (p.length < 4 || p.length > 12) return null;
  return p;
}

function resolvePairing(req, fallback) {
  return (
    normalizePairing(req?.query?.pairing) ||
    normalizePairing(req?.headers?.['x-pairing']) ||
    normalizePairing(fallback) ||
    null
  );
}

module.exports = { normalizePairing, resolvePairing };
