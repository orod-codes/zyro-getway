# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
