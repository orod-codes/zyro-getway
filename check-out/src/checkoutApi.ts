export interface MerchantAccount {
  accountNumber: string;
  holderName: string;
  providerLabel: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  recommended?: boolean;
}

export interface CheckoutConfig {
  ok: boolean;
  error?: string;
  orderReady?: boolean;
  pairingCode: string | null;
  merchantName: string;
  customerName: string;
  customerPhotoUrl: string;
  amountEtb: number;
  orderRef: string;
  paymentMethods: PaymentMethod[];
  accounts: Record<string, MerchantAccount>;
  zyroScript: string;
}

export interface GatewayIncomeTx {
  id?: string;
  amount?: number;
  name?: string;
  sender?: string;
  payerName?: string;
  accountSource?: string;
  smsAddress?: string;
  referenceNumber?: string;
  transactionNumber?: string;
  timestamp?: string;
}

const BANK_MATCH: Record<string, string[]> = {
  telebirr: ['127', 'telebirr'],
  cbe: ['cbe', 'commercial bank', '999'],
  awash: ['awash'],
  dashen: ['dashen'],
  hibret: ['hibret'],
  coop: ['coop', 'cbo'],
  abyssinia: ['abyssinia', 'boa'],
};

export function incomeMatchesBank(tx: GatewayIncomeTx, bankId: string): boolean {
  const keys = BANK_MATCH[bankId];
  if (!keys) return false;
  const hay = `${tx.smsAddress || ''} ${tx.accountSource || ''} ${tx.sender || ''} ${tx.name || ''}`.toLowerCase();
  return keys.some((k) => hay.includes(k));
}

export function refMatches(tx: GatewayIncomeTx, ref: string): boolean {
  const want = ref.trim().toUpperCase();
  if (want.length < 6) return false;
  const candidates = [
    tx.transactionNumber,
    tx.referenceNumber,
    tx.id,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim().toUpperCase());
  return candidates.some((c) => c === want || c.includes(want) || want.includes(c));
}

/** Forward checkout URL params (orderId + optional redirect fields) to the gateway. */
function checkoutQueryFromPage(): string {
  if (typeof window === 'undefined') return '';
  const p = new URLSearchParams(window.location.search);
  const keys = [
    'orderId',
    'order',
    'session',
    'customerName',
    'name',
    'customerPhotoUrl',
    'customerPhoto',
    'photo',
    'amountEtb',
    'amount',
    'orderRef',
    'merchantName',
  ];
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = p.get(k);
    if (v) out.set(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

export async function fetchCheckoutConfig(): Promise<CheckoutConfig> {
  const res = await fetch(`/api/checkout-config${checkoutQueryFromPage()}`, {
    cache: 'no-store',
  });
  const data = (await res.json()) as CheckoutConfig;
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Could not load order from main system');
  }
  if (data.orderReady === false) {
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    throw new Error(
      `No order loaded. Your store should link here, e.g. ${base}/checkout/?orderId=YOUR_ORDER_ID`,
    );
  }
  return data;
}

export function loadZyroScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as Window & { Zyro?: unknown }).Zyro) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Failed to load Zyro client'));
    document.head.appendChild(el);
  });
}
