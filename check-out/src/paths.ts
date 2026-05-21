/** Vite base is `/checkout/` when served from the gateway. */
export const BASE = import.meta.env.BASE_URL;

export const zyroLogoUrl = `${BASE}zyro-logo.png`;

export function assetUrl(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE}${clean}`;
}
