/**
 * Content-Security-Policy of the back-office, set per request by `src/middleware.ts` (nginx sends
 * none: deploy/nginx/snippets/house-csp.conf).
 *
 * Every console page is rendered per request (root layout `dynamic = 'force-dynamic'`), so scripts
 * are locked to a per-request nonce: Next reads it from the request's CSP header and puts it on its
 * own inline bootstrap and chunk scripts; `'strict-dynamic'` lets those chunks load the rest. An
 * injected `<script>` (inline or external) has no nonce and does not run. The admin loads no
 * third-party script, frame or font (next/font is self-hosted); images are its own /media, the
 * configured media hosts, YouTube thumbnails and OAuth profile pictures of members.
 */

/** Comma-separated absolute origins (NEXT_PUBLIC_MEDIA_HOSTS) → origins; invalid entries dropped. */
export function parseOrigins(csv: string | undefined): string[] {
  const out: string[] = [];
  for (const raw of (csv ?? '').split(',')) {
    const s = raw.trim();
    if (!s) continue;
    try {
      out.push(new URL(s).origin);
    } catch {
      // ignore a malformed entry rather than breaking every page
    }
  }
  return out;
}

const IMAGE_HOSTS = [
  'https://i.ytimg.com',
  'https://*.kakaocdn.net',
  'https://*.pstatic.net',
  'https://*.googleusercontent.com',
];

/** A fresh base64 nonce (128 bits). Works in the Edge runtime (Web Crypto). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface AdminCspOptions {
  nonce: string;
  /** `next dev`: React's dev build needs eval, and HMR uses a websocket. */
  dev?: boolean;
  mediaHosts?: readonly string[];
}

export function adminContentSecurityPolicy({
  nonce,
  dev = false,
  mediaHosts = [],
}: AdminCspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS, ...mediaHosts],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws:', 'wss:'] : [])],
    // Agency documents are previewed from in-memory blob: URLs (m-moderation DocumentViewer).
    'frame-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${[...new Set(values)].join(' ')}`)
    .join('; ');
}
