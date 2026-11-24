import { config } from 'zod';

/**
 * The enforced CSP has no 'unsafe-eval' in production, so zod's JIT probe (`Function("")`, run on
 * the first object parse) is blocked and reported as a violation; zod then falls back to its
 * interpreter anyway. Saying so up front skips the probe. Browser only (the server has no CSP and
 * keeps the JIT); every zod copy in the bundle shares this config (globalThis.__zod_globalConfig).
 */
if (typeof window !== 'undefined') config({ jitless: true });
