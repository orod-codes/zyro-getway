# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2026-05-21

### Added

- Auto-save to `zyro.data.js` now includes `paymentMethod` and `paymentMethodName` (Telebirr, CBE, Awash, …).
- Terminal income log shows payment method.

## [1.1.3] - 2026-05-21

### Fixed

- Single listen port: set `port` or `checkout.port` (not both on different numbers).
- Removed double-listen crash (`ERR_SERVER_ALREADY_LISTEN`).

## [1.1.2] - 2026-05-21

### Fixed

- `ERR_SERVER_ALREADY_LISTEN` when `checkout.port` equals gateway `port`.
- Clearer `EADDRINUSE` message when port 3001 is already taken.

## [1.1.1] - 2026-05-21

### Changed

- Clearer `zyro.config.js` comments for `ip` (auto) and `checkout.port`.

## [1.1.0] - 2026-05-21

### Added

- **`checkout.port`** in config (optional; defaults to gateway `port`).
- Auto **LAN IP** in `/api/checkout-config` (`gatewayIp`, `serverUrl`, `checkoutUrl`).
- **Express Checkout** UI at `/checkout/` (Telebirr, CBE, Awash, …).
- Order data from your **main system** via `checkout.orderApiUrl` + `?orderId=`.
- `GET /api/checkout-config`, bank accounts from `zyro.config.js`.
- Live payment verify against phone income (Socket.IO).
- `npm run build:checkout`, `npm run demo:orders`, [SETUP.md](SETUP.md).

### Fixed

- Checkout redirect loop (`ERR_TOO_MANY_REDIRECTS`).
- Logo path under `/checkout/` base URL.

### Changed

- Removed circular `zyro-gateway` npm dependency from package.
- `prepublishOnly` / `prestart` build checkout dist.
- Cleaner `.gitignore` (no `.npmrc`, no `check-out/node_modules`).
- npm pack includes `check-out/dist` via `.npmignore`.

## [1.0.2] - 2026-05-17

### Changed

- npm README sync (logo, docs, web/system wording) on **`z-getway`** and **`zyro-gateway@1.0.1`**.
- `npm run release` publishes both package names via `scripts/publish-all.js`.

## [1.0.0] - 2026-05-17

### Added

- Published on npm as **`z-getway`** (CLI: `z-getway`, alias: `zyro-gateway`).
- Modular server under `src/` (config, routes, Socket.IO, terminal logging).
- CLI: `z-getway config`, `z-getway help`, `npm run release` for publish.
- Programmatic API: `require('z-getway/server')` → `createGateway()`, `start()`.
- HTTP fallback: `POST /api/register`, `POST /api/income`, `POST /api/notification`.
- REST: dashboard, devices, transactions, notifications.
- Browser client (`Zyro.connect`) bundled to `dist/zyro.js`.
- Documentation: README setup, API reference, website integration.

### Changed

- npm package name `zyro-gateway` (the `zyro` name is already taken on npm).

[1.0.0]: https://github.com/orod-codes/zyro-getway/releases/tag/v1.0.0
