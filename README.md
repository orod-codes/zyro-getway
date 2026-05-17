# Zyro Gateway (`zyro` on npm)

Terminal server + browser client for syncing the Flutter monitor app with your website.

## Quick start

```bash
cd zyrogetway
npm install
npm run config    # creates ./zyro.config.js from example
# edit zyro.config.js — port, pairingCode, optional ip
npm start
```

Terminal prints **IP**, **port**, and **pairing code** for the phone app.

## `zyro.config.js`

| Field | Description |
|--------|-------------|
| `ip` | PC LAN address. Leave `''` to auto-detect. |
| `port` | Gateway port (default `3001`). |
| `pairingCode` | Must match Flutter **Setup → Zyro Gateway**. |
| `deviceName` | Optional web client label. |

Config is loaded from:

1. `ZYRO_CONFIG` env path (if set)
2. `./zyro.config.js` in the folder where you run `npm start`
3. `zyro.config.js` inside this package

## Phone app

**Setup → Zyro Gateway** — same IP, port, and pairing as the terminal.

USB: `adb reverse tcp:3001 tcp:3001` then use `127.0.0.1` on the phone.

## Website

```html
<script src="http://YOUR-IP:3001/socket.io/socket.io.js"></script>
<script src="http://YOUR-IP:3001/zyro/zyro.js"></script>
<script>
  const sync = Zyro.connect({
    ip: '192.168.1.10',
    port: 3001,
    pairingCode: 'MYSTORE',
    role: 'desktop',
    deviceName: 'My Store',
  });
  sync.on('transaction', (tx) => console.log('Income', tx));
</script>
```

## npm scripts

| Script | Action |
|--------|--------|
| `npm run config` | Create `zyro.config.js` in current directory |
| `npm run build` | Bundle browser client to `dist/zyro.js` |
| `npm start` | Build (if needed) + start gateway |
| `npm run dev` | Start with `--watch` |

## Install as dependency

```bash
npm install zyro
npx zyro-gateway
# or from your project after copying config:
npm run config   # in your app folder, with a local package link
```

## Publish

```bash
npm run build
npm publish
```
