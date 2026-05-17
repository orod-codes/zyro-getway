# Zyro Gateway

Real-time sync between the Zyro phone app and any website (transactions, notifications, devices).

## Install (for other websites)

```bash
npm install /path/to/this/folder
# or from npm when published:
# npm install zyro
```

## Run the gateway server

```bash
cd zyrogetway
npm install
npm start
```

Open http://localhost:3000

USB debugging with Android:

```bash
./start-usb.sh
```

## Configure your site

Copy `zyro.config.example.js` to `zyro.config.js`:

```javascript
window.ZYRO_CONFIG = {
  serverUrl: 'http://localhost:3000',
  pairingCode: 'MYSTORE',
  deviceName: 'My Website',
};
```

In HTML:

```html
<script src="http://localhost:3000/socket.io/socket.io.js"></script>
<script src="node_modules/zyro/dist/zyro.js"></script>
<script>
  const sync = Zyro.connect({ ...window.ZYRO_CONFIG });
  sync.on('transaction', (tx) => console.log(tx));
</script>
```

Use the **same** `pairingCode` in the Zyro app → Setup → Zyro Gateway.
