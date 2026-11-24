// Content-Security-Policy of the user site (+ /agent console), sent by next.config.mjs `headers()`.
// It is the only CSP of these pages: nginx sends none (deploy/nginx/snippets/house-csp.conf).
//
// Scripts: the pages are statically generated / ISR, so one HTML document is served to every
// visitor and a per-request nonce is impossible; Next's inline bootstrap scripts (RSC payload)
// differ per page, so hashes cannot be listed up front either. Inline scripts therefore stay
// allowed; every *external* script origin is pinned to the hosts the site really loads:
//   - Naver Maps JS v3 (components/map/naver.ts): oapi.map.naver.com, its submodules/tiles on
//     *.map.naver.net / *.pstatic.net
//   - Kakao(Daum) 우편번호 (features/w-deal/lib/daum-postcode.ts): t1.kakaocdn.net (t1.daumcdn.net is
//     the retired host), plus the origin of NEXT_PUBLIC_POSTCODE_SCRIPT_URL when it is overridden;
//     the embedded search iframe is postcode.map.kakao.com (postcode.map.daum.net before)
//   - YouTube embeds (features/w-content/videos/LiteYouTube.tsx): youtube-nocookie.com iframe
// Fonts are self-hosted by next/font (no Google Fonts request at runtime).

/** Comma-separated absolute origins ("https://cdn.example.kr,https://media.example.kr"). */
export function parseOrigins(csv) {
  return (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new URL(s).origin);
}

/** Origin of an absolute URL, or null. */
function originOf(url) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const NAVER_SCRIPT = [
  'https://oapi.map.naver.com',
  'https://*.map.naver.net',
  'https://*.pstatic.net',
];
const POSTCODE_SCRIPT = ['https://t1.kakaocdn.net', 'https://t1.daumcdn.net'];
// Scheme-less on purpose: the postcode script frames its search page with the page's own scheme,
// so this allows https on the site (https only, CSP never downgrades) and http on a local http dev
// server.
const POSTCODE_FRAME = ['postcode.map.kakao.com', 'postcode.map.daum.net'];
const YOUTUBE_FRAME = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
/** Map tiles/markers, YouTube thumbnails, OAuth profile pictures (Kakao, Naver, Google). */
const IMAGE_HOSTS = [
  'https://*.pstatic.net',
  'https://*.map.naver.net',
  'https://*.naver.com',
  'https://*.naver.net',
  'https://*.kakaocdn.net',
  'https://*.daumcdn.net',
  'https://*.googleusercontent.com',
  'https://i.ytimg.com',
];
/** Naver Maps SDK requests (auth, vector tiles, geocoder via NCP gateways). */
const NAVER_CONNECT = [
  'https://*.map.naver.com',
  'https://*.map.naver.net',
  'https://*.pstatic.net',
  'https://naveropenapi.apigw.ntruss.com',
  'https://maps.apigw.ntruss.com',
];

/**
 * @param {{ dev?: boolean; mediaHosts?: string[]; postcodeScriptUrl?: string }} [options]
 * @returns {string}
 */
export function contentSecurityPolicy({ dev = false, mediaHosts = [], postcodeScriptUrl } = {}) {
  const postcodeOverride = originOf(postcodeScriptUrl);
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      // React's dev build (call stacks, Fast Refresh) needs eval; production never does.
      ...(dev ? ["'unsafe-eval'"] : []),
      ...NAVER_SCRIPT,
      ...POSTCODE_SCRIPT,
      ...(postcodeOverride ? [postcodeOverride] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS, ...mediaHosts],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...NAVER_CONNECT, ...(dev ? ['ws:', 'wss:'] : [])],
    'frame-src': ["'self'", ...YOUTUBE_FRAME, ...POSTCODE_FRAME],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${[...new Set(values)].join(' ')}`)
    .join('; ');
}
