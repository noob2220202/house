// Content-Security-Policy of the user site (+ /agent console), sent by next.config.mjs `headers()`.
// It is the only CSP of these pages: nginx sends none (deploy/nginx/snippets/house-csp.conf).
//
// Scripts: the pages are statically generated / ISR, so one HTML document is served to every
// visitor and a per-request nonce is impossible; Next's inline bootstrap scripts (RSC payload)
// differ per page, so hashes cannot be listed up front either. Inline scripts therefore stay
// allowed; every *external* script origin is pinned to the hosts the site really loads:
//   - Kakao Maps JS SDK (components/map/kakao.ts): the loader dapi.kakao.com/v2/maps/sdk.js, which
//     (autoload=false → kakao.maps.load) appends the map core t1.daumcdn.net/mapjsapi/js/main/<v>/
//     kakao.js. Hosts read from the SDK source (loader + core 4.4.x): roadmap tiles
//     map.daumcdn.net/map_k3f_prod/…, skyview tiles map0–3.daumcdn.net, control/logo sprites
//     t1.daumcdn.net/mapjsapi/images/ + t1.daumcdn.net/localimg/…, blank tile s1.daumcdn.net/dmaps/
//     apis/white.png — all images (img-src *.daumcdn.net). The core makes no XHR/fetch for the
//     roadmap (only 로드뷰, which we do not use), so connect-src needs no Kakao host.
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

/** Kakao Maps loader (dapi) + map core (t1.daumcdn.net, shared with the postcode script below). */
const KAKAO_MAP_SCRIPT = ['https://dapi.kakao.com', 'https://t1.daumcdn.net'];
const POSTCODE_SCRIPT = ['https://t1.kakaocdn.net', 'https://t1.daumcdn.net'];
// Scheme-less on purpose: the postcode script frames its search page with the page's own scheme,
// so this allows https on the site (https only, CSP never downgrades) and http on a local http dev
// server.
const POSTCODE_FRAME = ['postcode.map.kakao.com', 'postcode.map.daum.net'];
const YOUTUBE_FRAME = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
/**
 * Kakao map tiles + SDK sprites (*.daumcdn.net: map, map0–3, t1, s1), YouTube thumbnails, OAuth
 * profile pictures (Kakao *.kakaocdn.net, Naver login *.pstatic.net, Google).
 */
const IMAGE_HOSTS = [
  'https://*.daumcdn.net',
  'https://*.kakaocdn.net',
  'https://*.pstatic.net',
  'https://*.googleusercontent.com',
  'https://i.ytimg.com',
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
      ...KAKAO_MAP_SCRIPT,
      ...POSTCODE_SCRIPT,
      ...(postcodeOverride ? [postcodeOverride] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...IMAGE_HOSTS, ...mediaHosts],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(dev ? ['ws:', 'wss:'] : [])],
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
