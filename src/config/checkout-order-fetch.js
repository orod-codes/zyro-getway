'use strict';

/**
 * Load customer name, photo, amount, order ref from the merchant's main system.
 * Configure checkout.orderApiUrl in zyro.config.js, e.g.
 *   http://localhost:4000/api/orders/{orderId}
 * Redirect shoppers to: /checkout/?orderId=ORD-123
 */

function pickQueryOrderOverrides(query) {
  if (!query || typeof query !== 'object') return null;
  const out = {};
  if (query.customerName || query.name) {
    out.customerName = String(query.customerName || query.name).trim();
  }
  if (query.customerPhotoUrl || query.customerPhoto || query.photo) {
    out.customerPhotoUrl = String(
      query.customerPhotoUrl || query.customerPhoto || query.photo,
    ).trim();
  }
  if (query.amountEtb != null || query.amount != null) {
    out.amountEtb = query.amountEtb ?? query.amount;
  }
  if (query.orderRef || query.orderId || query.order) {
    out.orderRef = String(query.orderRef || query.orderId || query.order).trim();
  }
  if (query.merchantName) out.merchantName = String(query.merchantName).trim();
  return Object.keys(out).length ? out : null;
}

function pickOrderId(query, paramName) {
  if (!query) return '';
  const key = paramName || 'orderId';
  const raw = query[key] ?? query.order ?? query.session ?? query.orderRef;
  return raw != null ? String(raw).trim() : '';
}

function normalizeOrderBody(body) {
  if (!body || typeof body !== 'object') return null;
  const row = body.data && typeof body.data === 'object' ? body.data : body;
  const order = row.order && typeof row.order === 'object' ? row.order : row;

  const customerName = String(
    order.customerName ||
      order.customer_name ||
      order.payerName ||
      order.payer_name ||
      order.name ||
      '',
  ).trim();

  const customerPhotoUrl = String(
    order.customerPhotoUrl ||
      order.customer_photo_url ||
      order.photoUrl ||
      order.photo_url ||
      order.photo ||
      order.avatar ||
      order.image ||
      '',
  ).trim();

  let amountEtb =
    order.amountEtb ?? order.amount_etb ?? order.amount ?? order.total ?? order.price;
  amountEtb = Number(amountEtb);
  if (!Number.isFinite(amountEtb) || amountEtb <= 0) amountEtb = null;

  const orderRef = String(
    order.orderRef || order.order_ref || order.orderId || order.order_id || order.id || '',
  ).trim();

  const out = {};
  if (customerName) out.customerName = customerName;
  if (customerPhotoUrl) out.customerPhotoUrl = customerPhotoUrl;
  if (amountEtb != null) out.amountEtb = amountEtb;
  if (orderRef) out.orderRef = orderRef;
  if (order.merchantName) out.merchantName = String(order.merchantName).trim();

  return Object.keys(out).length ? out : null;
}

async function fetchOrderFromMainSystem(orderApiUrl, orderId) {
  const base = String(orderApiUrl || '').trim();
  const id = String(orderId || '').trim();
  if (!base || !id) return null;

  const url = base.includes('{orderId}')
    ? base.replace(/\{orderId\}/g, encodeURIComponent(id))
    : `${base.replace(/\/$/, '')}/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const err = new Error(`Main system returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  const normalized = normalizeOrderBody(body);
  if (!normalized) {
    const err = new Error('Main system response missing customer or amount');
    err.status = 422;
    throw err;
  }
  return normalized;
}

/**
 * Resolve order display fields: external API first, then URL params from redirect.
 */
function queryHasFullOrder(fromQuery) {
  if (!fromQuery) return false;
  const amt = Number(fromQuery.amountEtb);
  return Boolean(fromQuery.customerName) && Number.isFinite(amt) && amt > 0;
}

async function resolveOrderData(checkout, query) {
  const orderId = pickOrderId(query, checkout?.orderIdParam);
  const apiUrl = String(checkout?.orderApiUrl || '').trim();
  const fromQuery = pickQueryOrderOverrides(query);

  if (queryHasFullOrder(fromQuery)) {
    return { ...fromQuery, orderId: orderId || fromQuery.orderRef || '' };
  }

  if (orderId && apiUrl) {
    return { ...(await fetchOrderFromMainSystem(apiUrl, orderId)), orderId };
  }

  if (fromQuery) return { ...fromQuery, orderId: orderId || fromQuery.orderRef || '' };

  return null;
}

module.exports = {
  pickQueryOrderOverrides,
  pickOrderId,
  normalizeOrderBody,
  fetchOrderFromMainSystem,
  resolveOrderData,
};
