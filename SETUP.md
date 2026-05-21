# Zyro Gateway — setup

## 1. Install

```bash
npm install z-getway
# or from this repo:
npm install && npm run config
```

## 2. Config (`zyro.config.js`)

| Section | You set | From your store API |
|---------|---------|---------------------|
| `ip` | Optional (`''` = auto LAN IP) | — |
| `port`, `pairingCode` | Yes — **one port** for API, phone, and `/checkout/` | — |
| `checkout.banks` | Account + holder per bank | — |
| `checkout.orderApiUrl` | URL to fetch orders | Returns customer, photo, amount |
| `checkout.defaultOrderId` | Dev only (`''` in prod) | — |

```bash
npx z-getway config
```

## 3. Start

```bash
npx z-getway
```

Terminal shows:

- Gateway URL for the phone app  
- **Checkout** `http://YOUR_IP:PORT/checkout/`

## 4. Phone app

Settings → **Zyro Gateway** → same **IP**, **port**, **pairing code** as config.

Built-in SMS senders: **127** (Telebirr), **cbe**, **awash**.

## 5. Express Checkout

Your store sends customers here:

```
http://YOUR_IP:PORT/checkout/?orderId=ORDER_123
```

Gateway calls `checkout.orderApiUrl` (e.g. `http://your-api/orders/{orderId}`) and shows:

- Customer name & photo  
- Amount  
- Bank accounts from config  

### Main system API response

```json
{
  "customerName": "Abebe Kebede",
  "customerPhotoUrl": "https://optional-photo.jpg",
  "amountEtb": 2850,
  "orderRef": "ORDER_123"
}
```

### Local demo (no real store yet)

```bash
# terminal 1
npm run demo:orders

# terminal 2
npx z-getway
# open http://YOUR_IP:3001/checkout/
```

Set in config:

```js
orderApiUrl: 'http://127.0.0.1:4000/api/orders/{orderId}',
defaultOrderId: 'ZY-9942',  // only for testing without ?orderId=
```

## 6. Website / POS (live income)

```html
<script src="http://YOUR_IP:3001/zyro/zyro.js"></script>
<script>
  const z = Zyro.connect({
    serverUrl: 'http://YOUR_IP:3001',
    pairingCode: 'MYSTORE',
    role: 'desktop',
  });
  z.on('transaction', (tx) => console.log(tx));
</script>
```

## Publish (maintainers)

```bash
npm login
npm run release
```

Publishes **`z-getway`** and **`zyro-gateway`** (same code, two npm names).
