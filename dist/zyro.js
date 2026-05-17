var Zyro = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // zyro/browser-entry.js
  var browser_entry_exports = {};
  __export(browser_entry_exports, {
    DEFAULTS: () => DEFAULTS,
    EVENTS: () => EVENTS,
    ZyroConnection: () => ZyroConnection,
    connect: () => connect
  });

  // zyro/zyro.js
  var DEFAULTS = {
    ip: "",
    port: 3e3,
    serverUrl: "",
    pairingCode: "",
    role: "desktop",
    deviceName: "Web Client",
    autoConnect: true,
    pollIntervalMs: 1500,
    maxItems: 200
  };
  function resolveBaseUrl(config) {
    if (config.serverUrl) return normalizeUrl(config.serverUrl);
    const ip = String(config.ip || "").trim();
    const port = Number(config.port) || 3e3;
    if (!ip) {
      if (typeof location !== "undefined") {
        return normalizeUrl(`http://${location.hostname}:${port}`);
      }
      throw new Error("Zyro: set ip and port in zyro.config.js");
    }
    return normalizeUrl(`http://${ip}:${port}`);
  }
  var EVENTS = {
    READY: "ready",
    STATUS: "status",
    ERROR: "error",
    TRANSACTION: "transaction",
    NOTIFICATION: "notification",
    DASHBOARD: "dashboard",
    PRESENCE: "presence",
    DEVICES: "devices"
  };
  function normalizeUrl(url) {
    let u = String(url || "").trim().replace(/\/+$/, "");
    if (!u && typeof location !== "undefined") return location.origin;
    if (u.startsWith("ws://")) u = `http://${u.slice(5)}`;
    if (u.startsWith("wss://")) u = `https://${u.slice(6)}`;
    return u;
  }
  function normalizePairing(raw) {
    const p = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (p.length < 4 || p.length > 12) return "";
    return p;
  }
  function txKey(tx) {
    if (tx.id) return String(tx.id);
    return `${tx.transactionNumber || tx.referenceNumber || ""}|${tx.timestamp || tx.receivedAt}|${tx.amount}`;
  }
  function noteKey(n) {
    if (n.id) return String(n.id);
    return `${n.timestamp || n.receivedAt}|${n.preview}`;
  }
  var ZyroConnection = class {
    constructor(options = {}) {
      this.config = { ...DEFAULTS, ...options };
      this._handlers = /* @__PURE__ */ new Map();
      this._socket = null;
      this._baseUrl = "";
      this._pairingCode = "";
      this._status = "idle";
      this._pollTimers = [];
      this.transactions = [];
      this.notifications = [];
      this.devices = /* @__PURE__ */ new Map();
      this.dashboard = null;
      this.presence = { phones: 0, desktops: 0 };
      this._seenTx = /* @__PURE__ */ new Set();
      this._seenNotes = /* @__PURE__ */ new Set();
      this._lastTxTime = "";
      this._lastNoteTime = "";
      if (this.config.autoConnect) {
        this.connect().catch((err) => this._emit(EVENTS.ERROR, err));
      }
    }
    on(event, fn) {
      if (!this._handlers.has(event)) this._handlers.set(event, /* @__PURE__ */ new Set());
      this._handlers.get(event).add(fn);
      return () => this.off(event, fn);
    }
    off(event, fn) {
      this._handlers.get(event)?.delete(fn);
    }
    _emit(event, ...args) {
      const set = this._handlers.get(event);
      if (!set) return;
      for (const fn of [...set]) fn(...args);
    }
    _setStatus(status, detail = {}) {
      this._status = status;
      this._emit(EVENTS.STATUS, { status, ...detail });
    }
    async connect() {
      this._baseUrl = resolveBaseUrl(this.config);
      this._setStatus("connecting");
      const infoRes = await fetch(`${this._baseUrl}/api/info`, { cache: "no-store" });
      if (!infoRes.ok) throw new Error(`Zyro: cannot reach server (${infoRes.status})`);
      const configured = normalizePairing(this.config.pairingCode);
      if (!configured) {
        throw new Error(
          "Zyro: pairingCode is required in zyro.config.js (4\u201312 letters/numbers)"
        );
      }
      this._pairingCode = configured;
      const info = await infoRes.json();
      const cfgPort = Number(this.config.port) || 3e3;
      if (info.port && info.port !== cfgPort) {
        console.warn(
          `Zyro: server port is ${info.port} but zyro.config.js port is ${cfgPort} \u2014 fix port and restart npm start`
        );
      }
      if (info.ip && !this.config.ip) {
        this.config.ip = info.ip;
      }
      this._connectSocket();
      this._startPollers();
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            this._pollTransactions();
            this._pollNotifications();
            this._refreshDashboard();
            if (this._socket && !this._socket.connected) this._socket.connect();
          }
        });
      }
      return { pairingCode: this._pairingCode, serverUrl: this._baseUrl };
    }
    async setPairingCode(code) {
      const next = normalizePairing(code);
      if (!next) throw new Error("Zyro: invalid pairing code (4\u201312 letters/numbers)");
      this.config.pairingCode = next;
      this.disconnect();
      this._seenTx.clear();
      this._seenNotes.clear();
      this._lastTxTime = "";
      this._lastNoteTime = "";
      this.transactions.length = 0;
      this.notifications.length = 0;
      this.devices.clear();
      return this.connect();
    }
    _pairingQuery(extra = {}) {
      const params = new URLSearchParams({ pairing: this._pairingCode, ...extra });
      return `?${params.toString()}`;
    }
    _fetchOpts() {
      return {
        cache: "no-store",
        headers: { "X-Pairing": this._pairingCode }
      };
    }
    disconnect() {
      this._stopPollers();
      if (this._socket) {
        this._socket.removeAllListeners();
        this._socket.disconnect();
        this._socket = null;
      }
      this._setStatus("disconnected");
    }
    _connectSocket() {
      const io = typeof globalThis !== "undefined" ? globalThis.io : null;
      if (!io) {
        this._setStatus("polling", { reason: "socket.io not loaded \u2014 using HTTP poll only" });
        return;
      }
      if (this._socket) {
        this._socket.removeAllListeners();
        this._socket.disconnect();
      }
      this._socket = io(this._baseUrl, {
        query: {
          pairing: this._pairingCode,
          role: this.config.role,
          deviceName: this.config.deviceName
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1e3,
        reconnectionDelayMax: 5e3,
        timeout: 2e4
      });
      this._socket.on("connect", () => {
        this._setStatus("connected");
        this._pollTransactions();
        this._pollNotifications();
        this._refreshDashboard();
      });
      this._socket.on("disconnect", () => this._setStatus("reconnecting"));
      this._socket.on("connect_error", () => this._setStatus("reconnecting"));
      this._socket.io.on("reconnect", () => {
        this._pollTransactions();
        this._pollNotifications();
        this._refreshDashboard();
      });
      this._socket.on("sync_ready", (data) => {
        this._emit(EVENTS.READY, data);
        this._pollTransactions();
        this._pollNotifications();
        this._refreshDashboard();
      });
      this._socket.on("presence", (data) => {
        this.presence = data;
        if (Array.isArray(data.devices)) this._mergeDevices(data.devices);
        this._emit(EVENTS.PRESENCE, data);
        this._emit(EVENTS.DEVICES, this.getDevices());
      });
      this._socket.on("device_joined", (d) => {
        this._upsertDevice(d);
        this._emit(EVENTS.DEVICES, this.getDevices());
      });
      this._socket.on("device_updated", (d) => {
        this._upsertDevice(d);
        this._emit(EVENTS.DEVICES, this.getDevices());
      });
      this._socket.on("device_left", ({ id }) => {
        this.devices.delete(id);
        this._emit(EVENTS.DEVICES, this.getDevices());
      });
      this._socket.on("history", (list) => this._mergeTxList(list));
      this._socket.on("notification_history", (list) => this._mergeNoteList(list));
      this._socket.on("income_transaction", (tx) => {
        if (this._addTransaction(tx)) this._emit(EVENTS.TRANSACTION, tx);
      });
      this._socket.on("notification_event", (note) => {
        if (this._addNotification(note)) this._emit(EVENTS.NOTIFICATION, note);
      });
      this._socket.on("dashboard_update", (payload) => {
        this.dashboard = payload;
        this._emit(EVENTS.DASHBOARD, payload);
      });
    }
    _startPollers() {
      this._stopPollers();
      const ms = this.config.pollIntervalMs;
      this._pollTransactions();
      this._pollNotifications();
      this._refreshDashboard();
      this._pollTimers.push(setInterval(() => this._pollTransactions(), ms));
      this._pollTimers.push(setInterval(() => this._pollNotifications(), ms));
      this._pollTimers.push(setInterval(() => this._refreshDashboard(), ms * 2));
    }
    _stopPollers() {
      for (const t of this._pollTimers) clearInterval(t);
      this._pollTimers = [];
    }
    async _pollTransactions() {
      try {
        const extra = this._lastTxTime ? { after: this._lastTxTime } : {};
        const data = await fetch(
          `${this._baseUrl}/api/transactions${this._pairingQuery(extra)}`,
          this._fetchOpts()
        ).then((r) => r.json());
        for (const tx of data.transactions || []) {
          if (this._addTransaction(tx)) this._emit(EVENTS.TRANSACTION, tx);
        }
      } catch (_) {
      }
    }
    async _pollNotifications() {
      try {
        const extra = this._lastNoteTime ? { after: this._lastNoteTime } : {};
        const data = await fetch(
          `${this._baseUrl}/api/notifications${this._pairingQuery(extra)}`,
          this._fetchOpts()
        ).then((r) => r.json());
        for (const note of data.notifications || []) {
          if (this._addNotification(note)) this._emit(EVENTS.NOTIFICATION, note);
        }
      } catch (_) {
      }
    }
    async _refreshDashboard() {
      try {
        const data = await fetch(
          `${this._baseUrl}/api/dashboard${this._pairingQuery()}`,
          this._fetchOpts()
        ).then((r) => r.json());
        this.dashboard = data;
        if (data.stats) {
          this.presence = {
            phones: data.stats.phones,
            desktops: data.stats.desktops
          };
        }
        this._emit(EVENTS.DASHBOARD, data);
      } catch (_) {
      }
      try {
        const data = await fetch(
          `${this._baseUrl}/api/devices${this._pairingQuery()}`,
          this._fetchOpts()
        ).then((r) => r.json());
        if (Array.isArray(data.devices)) {
          this.devices.clear();
          this._mergeDevices(data.devices);
          this._emit(EVENTS.DEVICES, this.getDevices());
        }
      } catch (_) {
      }
    }
    _addTransaction(tx) {
      const key = txKey(tx);
      if (this._seenTx.has(key)) return false;
      this._seenTx.add(key);
      const t = String(tx.receivedAt || tx.timestamp || "");
      if (t && t > this._lastTxTime) this._lastTxTime = t;
      this.transactions.unshift(tx);
      while (this.transactions.length > this.config.maxItems) {
        const removed = this.transactions.pop();
        this._seenTx.delete(txKey(removed));
      }
      return true;
    }
    _mergeTxList(list) {
      if (!Array.isArray(list)) return;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (this._addTransaction(list[i])) this._emit(EVENTS.TRANSACTION, list[i]);
      }
    }
    _addNotification(note) {
      const key = noteKey(note);
      if (this._seenNotes.has(key)) return false;
      this._seenNotes.add(key);
      const t = String(note.receivedAt || note.timestamp || "");
      if (t && t > this._lastNoteTime) this._lastNoteTime = t;
      this.notifications.unshift(note);
      while (this.notifications.length > this.config.maxItems) {
        const removed = this.notifications.pop();
        this._seenNotes.delete(noteKey(removed));
      }
      return true;
    }
    _mergeNoteList(list) {
      if (!Array.isArray(list)) return;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (this._addNotification(list[i])) this._emit(EVENTS.NOTIFICATION, list[i]);
      }
    }
    _upsertDevice(d) {
      if (!d?.id) return;
      this.devices.set(d.id, { ...this.devices.get(d.id), ...d, online: true });
    }
    _mergeDevices(list) {
      for (const d of list) this._upsertDevice(d);
    }
    getDevices() {
      return Array.from(this.devices.values());
    }
    get isConnected() {
      return this._status === "connected";
    }
    get pairingCode() {
      return this._pairingCode;
    }
    get serverUrl() {
      return this._baseUrl;
    }
  };
  function connect(options) {
    return new ZyroConnection(options);
  }
  return __toCommonJS(browser_entry_exports);
})();
