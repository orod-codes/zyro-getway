const $ = (id) => document.getElementById(id);

const PANEL_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Real-time monitoring from your connected phone',
  },
  transactions: {
    title: 'Transactions',
    subtitle: 'Live income stream synced from the Zyro app',
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'SMS and bank alerts mirrored from your phone',
  },
  devices: {
    title: 'Devices',
    subtitle: 'Manage phone and web connections on this pairing room',
  },
};

/** @type {import('../zyro/zyro.js').ZyroConnection | null} */
let sync = null;

function init() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => showPanel(btn.dataset.panel));
  });

  $('copyPairing').addEventListener('click', async () => {
    const code = sync?.pairingCode || $('pairingCode').textContent;
    await navigator.clipboard.writeText(code);
    $('copyPairing').textContent = 'Copied!';
    setTimeout(() => {
      $('copyPairing').textContent = 'Copy code';
    }, 1500);
  });

  $('demoNotification').addEventListener('click', simulateNotification);
  $('demoTransaction').addEventListener('click', simulateTransaction);

  const cfg = { ...(window.ZYRO_CONFIG || {}), autoConnect: false };
  sync = Zyro.connect(cfg);

  sync.on(Zyro.EVENTS.READY, () => {
    $('pairingCode').textContent = sync.pairingCode;
    $('serverUrl').textContent = sync.serverUrl;
  });

  sync.on(Zyro.EVENTS.STATUS, ({ status }) => {
    const pill = $('serverStatus');
    if (status === 'connected') {
      pill.textContent = 'Web: live';
      pill.classList.add('online', 'live-pulse');
      $('healthWeb').textContent = 'Connected';
    } else if (status === 'connecting') {
      pill.textContent = 'Web: connecting…';
      pill.classList.remove('online', 'live-pulse');
    } else {
      pill.textContent = 'Web: reconnecting…';
      pill.classList.remove('online', 'live-pulse');
      $('healthWeb').textContent = status === 'polling' ? 'Poll only' : 'Reconnecting';
    }
  });

  sync.on(Zyro.EVENTS.PRESENCE, (data) => updatePhoneStatus(data.phones || 0));
  sync.on(Zyro.EVENTS.DEVICES, () => renderDevices());
  sync.on(Zyro.EVENTS.TRANSACTION, () => {
    renderFeed();
    renderActivityChart();
    flashNewIncome();
  });
  sync.on(Zyro.EVENTS.NOTIFICATION, () => renderNotificationFeed());
  sync.on(Zyro.EVENTS.DASHBOARD, (data) => {
    applyDashboard(data);
    $('healthServerTime').textContent = formatTime(data.serverTime);
    renderDevices();
  });

  sync
    .connect()
    .then(({ pairingCode, serverUrl }) => {
      $('pairingCode').textContent = pairingCode;
      $('serverUrl').textContent = serverUrl;
    })
    .catch((err) => {
      $('serverStatus').textContent = 'Web: error';
      console.error(err);
    });
}

function showPanel(name) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.panel === name);
  });
  document.querySelectorAll('.panel').forEach((p) => {
    p.classList.toggle('active', p.id === `panel-${name}`);
  });
  const meta = PANEL_META[name] || PANEL_META.dashboard;
  $('panelTitle').textContent = meta.title;
  $('panelSubtitle').textContent = meta.subtitle;
}

function updatePhoneStatus(phones) {
  const pill = $('phoneStatus');
  $('healthPhone').textContent = phones > 0 ? `Connected (${phones})` : 'Waiting';
  if (phones > 0) {
    pill.textContent = `Phone: connected (${phones})`;
    pill.classList.add('phone-on');
  } else {
    pill.textContent = 'Phone: waiting';
    pill.classList.remove('phone-on');
  }
}

function txName(tx) {
  return tx.name || tx.payerName || tx.sender || 'Unknown';
}

function txNumber(tx) {
  return tx.transactionNumber || tx.referenceNumber || '—';
}

function applyDashboard(data) {
  if (!data?.stats) return;
  const s = data.stats;
  $('dashTodayTotal').textContent = `ETB ${formatMoney(s.todayTotal)}`;
  $('dashTxCount').textContent = String(s.transactionCount);
  $('dashNoteCount').textContent = String(s.notificationCount);
  $('dashMatchedCount').textContent = String(s.matchedNotificationCount);
  $('todayTotal').textContent = `ETB ${formatMoney(s.todayTotal)}`;
  $('txCount').textContent = String(s.transactionCount);
  updatePhoneStatus(s.phones || 0);

  renderCompactList(
    $('dashRecentTx'),
    data.recentTransactions || [],
    (tx) =>
      `<span class="amount">+ETB ${formatMoney(Number(tx.amount) || 0)}</span> ${escapeHtml(txName(tx))} · ${formatTime(tx.timestamp || tx.receivedAt)}`,
    'No transactions yet',
  );

  renderCompactList(
    $('dashRecentNotes'),
    data.recentNotifications || [],
    (n) =>
      `${channelBadgeHtml(n.channel)} ${escapeHtml(n.source || 'Unknown')} · ${escapeHtml(truncate(n.preview || n.title, 60))}`,
    'No notifications yet',
  );
}

function renderCompactList(el, items, mapFn, emptyText) {
  if (!items.length) {
    el.innerHTML = `<li class="compact-empty">${emptyText}</li>`;
    return;
  }
  el.innerHTML = items.map((item) => `<li>${mapFn(item)}</li>`).join('');
}

function renderFeed() {
  const feed = $('feed');
  const transactions = sync?.transactions || [];
  $('txCount').textContent = String(transactions.length);
  $('todayTotal').textContent = `ETB ${formatMoney(todayTotal(transactions))}`;

  if (transactions.length === 0) {
    feed.innerHTML =
      '<li class="feed-empty">Waiting for income from your phone…</li>';
    return;
  }

  feed.innerHTML = transactions
    .map(
      (tx) => `
    <li class="feed-item">
      <div class="feed-amount">+ETB ${formatMoney(Number(tx.amount) || 0)}</div>
      <div class="feed-sender">${escapeHtml(txName(tx))}</div>
      <div class="feed-ref">Txn ${escapeHtml(String(txNumber(tx)))}</motion>
      <div class="feed-meta">${escapeHtml(tx.accountSource || '')} · ${formatTime(tx.timestamp || tx.receivedAt)}</div>
    </li>`,
    )
    .join('');
}

function renderNotificationFeed() {
  const feed = $('notificationFeed');
  const notifications = sync?.notifications || [];
  if (notifications.length === 0) {
    feed.innerHTML =
      '<li class="feed-empty">No notifications yet — connect your phone or use Simulate.</li>';
    return;
  }

  feed.innerHTML = notifications
    .map((n) => {
      const ch = String(n.channel || 'unknown').toLowerCase();
      const matched = n.matched ? '<span class="note-badge matched">Income</span>' : '';
      return `
    <li class="note-item">
      <div class="note-head">
        ${channelBadgeHtml(ch)}
        ${matched}
        <span class="note-source">${escapeHtml(n.source || 'Unknown')}</span>
        <span class="note-time">${formatTime(n.timestamp || n.receivedAt)}</span>
      </motion>
      ${n.title ? `<div class="note-source">${escapeHtml(n.title)}</div>` : ''}
      <div class="note-preview">${escapeHtml(n.preview || '')}</div>
    </li>`;
    })
    .join('');
}

function channelBadgeHtml(channel) {
  const ch = String(channel || 'unknown').toLowerCase();
  const label = ch === 'parsed' ? 'Matched' : ch;
  return `<span class="note-badge ${escapeHtml(ch)}">${escapeHtml(label)}</span>`;
}

function renderDevices() {
  const tbody = $('deviceTableBody');
  const list = sync?.getDevices() || [];
  if (list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-cell">No devices connected</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map(
      (d) => `
    <tr>
      <td>${escapeHtml(d.deviceName || d.id)}</td>
      <td><span class="role-tag ${escapeHtml(d.role || '')}">${escapeHtml(d.role || '—')}</span></td>
      <td>${escapeHtml(d.platform || '—')}</td>
      <td>${formatTime(d.connectedAt)}</td>
      <td>${formatTime(d.lastSeen)}</td>
    </tr>`,
    )
    .join('');
}

function renderActivityChart() {
  const el = $('activityChart');
  const transactions = sync?.transactions || [];
  const buckets = new Array(12).fill(0);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;

  for (const tx of transactions) {
    const t = new Date(tx.timestamp || tx.receivedAt).getTime();
    if (Number.isNaN(t) || now - t > 60 * 60 * 1000) continue;
    const idx = Math.min(11, Math.floor((now - t) / windowMs));
    buckets[11 - idx] += Number(tx.amount) || 0;
  }

  const max = Math.max(...buckets, 1);
  el.innerHTML = buckets
    .map((v) => {
      const h = Math.max(4, Math.round((v / max) * 100));
      return `<div class="bar" style="height:${h}%" title="ETB ${formatMoney(v)}"></div>`;
    })
    .join('');
}

function todayTotal(transactions) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return transactions
    .filter((tx) => new Date(tx.timestamp || tx.receivedAt) >= start)
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
}

async function simulateNotification() {
  const payload = {
    id: `demo_n_${Date.now()}`,
    channel: 'notification',
    source: 'Demo Bank',
    title: 'Credit alert',
    preview: 'You have received ETB 1,250.00 from ABE BEKELE. Ref FT123456.',
    timestamp: new Date().toISOString(),
    matched: false,
  };
  await postDemo('/api/notification', payload);
}

async function simulateTransaction() {
  const payload = {
    id: `demo_tx_${Date.now()}`,
    amount: 1250 + Math.floor(Math.random() * 500),
    name: 'Demo Payer',
    transactionNumber: `FT${Date.now().toString().slice(-8)}`,
    sender: 'Demo Bank',
    payerName: 'Demo Payer',
    type: 'credit',
    accountSource: 'Commercial Bank',
    timestamp: new Date().toISOString(),
    direction: 'income',
  };
  await postDemo('/api/income', payload);
}

async function postDemo(path, body) {
  const base = sync?.serverUrl || '';
  const code = sync?.pairingCode || '';
  try {
    await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pairing': code },
      body: JSON.stringify(body),
    });
  } catch (_) {
    /* ignore */
  }
}

function formatMoney(n) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function escapeHtml(text) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function flashNewIncome() {
  document.body.classList.add('income-flash');
  setTimeout(() => document.body.classList.remove('income-flash'), 400);
}

init();
