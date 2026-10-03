// Shared API-key rotator with automatic failover.
//
// Reads all keys configured for a service from environment variables:
//   <SERVICE>_API_KEY          (primary / legacy name)
//   <SERVICE>_API_KEY_1.._10   (additional keys)
//
// When a key hits its limit (HTTP 429 / 402) or is rejected (401 / 403),
// it is put on a short cooldown and the next key is tried automatically.
// Keys come back into rotation once their cooldown expires, so a key that
// resets its quota starts serving again without a redeploy.

const COOLDOWN_MS = 10 * 60 * 1000; // skip a limited key for 10 minutes

// key identity -> timestamp until which the key is skipped
const cooldownUntil = new Map<string, number>();

export interface BuildRequest {
  url: string;
  headers?: Record<string, string>;
}

export interface RotationResult {
  data: any | null;
  /** 0-based index of the key that succeeded; -1 when nothing worked */
  keyIndex: number;
  error?: string;
}

/** Collect every configured key for a service (base name + numbered ones). */
export function getServiceKeys(service: string): string[] {
  const keys: string[] = [];
  const base = Deno.env.get(`${service}_API_KEY`);
  if (base && base.trim()) keys.push(base.trim());
  for (let i = 1; i <= 10; i++) {
    const k = Deno.env.get(`${service}_API_KEY_${i}`);
    if (k && k.trim()) keys.push(k.trim());
  }
  return keys;
}

/** Manually flag a key as rate-limited (e.g. when the provider signals it in a 200 body). */
export function markKeyLimited(service: string, keyIndex: number, ms: number = COOLDOWN_MS) {
  cooldownUntil.set(`${service}:${keyIndex}`, Date.now() + ms);
}

/**
 * Fetch JSON with automatic key rotation.
 *
 * `build` receives the current API key and returns the URL (+ optional
 * extra headers). On rate-limit / auth failures the next key is tried.
 * Set `allowKeyless` to make one attempt with an empty key when the
 * service has no keys configured (e.g. CoinGecko free tier).
 */
export async function fetchJsonWithRotation(
  service: string,
  build: (apiKey: string) => BuildRequest,
  opts: {
    validate?: (data: any) => boolean;
    allowKeyless?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<RotationResult> {
  const keys = getServiceKeys(service);
  if (keys.length === 0 && !opts.allowKeyless) {
    return { data: null, keyIndex: -1, error: `No ${service} API keys configured` };
  }

  const now = Date.now();
  const candidates: { key: string; idx: number }[] = [];
  keys.forEach((key, idx) => candidates.push({ key, idx }));
  if (keys.length === 0 && opts.allowKeyless) candidates.push({ key: '', idx: -1 });

  // Try keys that are NOT on cooldown first, then cooled-down ones as a
  // last resort (the limit may have reset already).
  candidates.sort((a, b) => {
    const ua = cooldownUntil.get(`${service}:${a.idx}`) ?? 0;
    const ub = cooldownUntil.get(`${service}:${b.idx}`) ?? 0;
    const aActive = ua <= now ? 0 : 1;
    const bActive = ub <= now ? 0 : 1;
    return aActive - bActive;
  });

  let lastError = '';
  for (const { key, idx } of candidates) {
    const until = cooldownUntil.get(`${service}:${idx}`) ?? 0;
    const onCooldown = until > now;
    try {
      const { url, headers } = build(key);
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...(headers ?? {}) },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });

      if ([429, 402, 401, 403].includes(res.status)) {
        lastError = `HTTP ${res.status}`;
        console.warn(`[rotator] ${service} key #${idx + 1} ${onCooldown ? '(cooldown retry) ' : ''}rejected: ${lastError} — rotating to next key`);
        cooldownUntil.set(`${service}:${idx}`, now + COOLDOWN_MS);
        continue;
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        console.warn(`[rotator] ${service} key #${idx + 1} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (opts.validate && !opts.validate(data)) {
        lastError = 'unexpected payload';
        console.warn(`[rotator] ${service} key #${idx + 1} returned unexpected payload — rotating`);
        continue;
      }
      return { data, keyIndex: idx };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[rotator] ${service} key #${idx + 1} request failed: ${lastError}`);
    }
  }

  return { data: null, keyIndex: -1, error: lastError };
}
