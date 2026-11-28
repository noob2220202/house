// Owned by the agencies module team. 사무소 홈페이지 (`https://<slug>.<root domain>`): slug rules,
// brand colours and URL helpers shared by the API (validation, origin policy), the web
// (middleware host routing, console form) and deploy/sites.sh (which re-implements the slug rule
// in shell — keep the two in sync).
import { z } from 'zod';
import type { EnumValue } from '../enums/define';
import { hexToRgb } from '../utils/color';

// ---------- slug ----------

export const SITE_SLUG_MIN_LENGTH = 3;
export const SITE_SLUG_MAX_LENGTH = 30;

/**
 * One DNS label: lowercase letters, digits and inner hyphens. `--` is refused separately (it
 * blocks punycode `xn--` labels and look-alike hosts).
 */
export const SITE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Labels an office can never take: infrastructure hosts, the platform's own names and paths, and
 * words that would make an office site look official. Compared after {@link normalizeSiteSlug}.
 */
export const RESERVED_SITE_SLUGS: ReadonlySet<string> = new Set([
  'www',
  'admin',
  'api',
  'app',
  'apps',
  'm',
  'mobile',
  'mail',
  'email',
  'smtp',
  'imap',
  'pop',
  'pop3',
  'ftp',
  'sftp',
  'ns',
  'ns1',
  'ns2',
  'dns',
  'mx',
  'webmail',
  'autodiscover',
  'autoconfig',
  'static',
  'assets',
  'cdn',
  'img',
  'image',
  'images',
  'media',
  'upload',
  'uploads',
  'files',
  'dev',
  'test',
  'testing',
  'staging',
  'stage',
  'beta',
  'alpha',
  'demo',
  'local',
  'localhost',
  'preview',
  'help',
  'support',
  'cs',
  'blog',
  'news',
  'status',
  'docs',
  'doc',
  'wiki',
  'about',
  'login',
  'logout',
  'auth',
  'oauth',
  'sso',
  'signup',
  'register',
  'account',
  'accounts',
  'me',
  'my',
  'agent',
  'agents',
  'agency',
  'agencies',
  'office',
  'offices',
  'site',
  'sites',
  'map',
  'maps',
  'search',
  'listing',
  'listings',
  'complex',
  'complexes',
  'deal',
  'deals',
  'home',
  'root',
  'system',
  'server',
  'web',
  'www1',
  'www2',
  'billing',
  'pay',
  'payment',
  'shop',
  'store',
  'ads',
  'ad',
  'suncheon',
  'suncheonmap',
  'house',
  'brand',
  'official',
  'notice',
  'notices',
  'event',
  'events',
  'kakao',
  'naver',
  'google',
  'apple',
  'null',
  'undefined',
]);

/** Canonical form of a slug as typed: trimmed and lower-cased (nothing else is rewritten). */
export function normalizeSiteSlug(s: string): string {
  return s.trim().toLowerCase();
}

export type SiteSlugProblem = 'INVALID' | 'RESERVED';

/** Why a slug cannot be used (normalised first), or null when it can. Uniqueness is the API's job. */
export function siteSlugProblem(s: string): SiteSlugProblem | null {
  const slug = normalizeSiteSlug(s);
  if (
    slug.length < SITE_SLUG_MIN_LENGTH ||
    slug.length > SITE_SLUG_MAX_LENGTH ||
    !SITE_SLUG_PATTERN.test(slug) ||
    slug.includes('--')
  ) {
    return 'INVALID';
  }
  return RESERVED_SITE_SLUGS.has(slug) ? 'RESERVED' : null;
}

export function isValidSiteSlug(s: string): boolean {
  return siteSlugProblem(s) === null;
}

/** Korean message for an unusable slug (form hint and zod message), or null when it is usable. */
export function siteSlugMessage(s: string): string | null {
  const slug = normalizeSiteSlug(s);
  if (slug.length < SITE_SLUG_MIN_LENGTH || slug.length > SITE_SLUG_MAX_LENGTH) {
    return `홈페이지 주소는 ${SITE_SLUG_MIN_LENGTH}~${SITE_SLUG_MAX_LENGTH}자로 입력해 주세요.`;
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return '홈페이지 주소에는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있어요.';
  }
  if (!SITE_SLUG_PATTERN.test(slug) || slug.includes('--')) {
    return '하이픈(-)은 처음과 끝에 쓸 수 없고, 두 번 이어 쓸 수 없어요.';
  }
  if (RESERVED_SITE_SLUGS.has(slug)) return '쓸 수 없는 주소예요. 다른 주소를 입력해 주세요.';
  return null;
}

/** A slug as sent by a client: normalised, then validated (format + reserved words). */
export const siteSlugSchema = z
  .string({ error: '홈페이지 주소를 입력해 주세요.' })
  .max(100, `홈페이지 주소는 ${SITE_SLUG_MAX_LENGTH}자 이하로 입력해 주세요.`)
  .transform(normalizeSiteSlug)
  .superRefine((slug, ctx) => {
    const message = siteSlugMessage(slug);
    if (message) ctx.addIssue({ code: 'custom', message });
  });

// ---------- hosts and URLs ----------

/**
 * `https://<slug>.<rootDomain>[:port]`. `protocol` takes "https:" / "http:" (with or without the
 * colon); a port equal to the protocol's default is left out.
 */
export function siteUrl(
  slug: string,
  rootDomain: string,
  protocol: string = 'https:',
  port?: string | number | null,
): string {
  const scheme = protocol.replace(/:$/, '').toLowerCase();
  const p = port === undefined || port === null ? '' : String(port);
  const defaultPort = scheme === 'https' ? '443' : scheme === 'http' ? '80' : '';
  const suffix = p && p !== defaultPort ? `:${p}` : '';
  return `${scheme}://${normalizeSiteSlug(slug)}.${rootDomain.toLowerCase()}${suffix}`;
}

/**
 * The office slug a request host addresses, or null: `host` (as in a Host header, port allowed)
 * must be exactly one label under `rootDomain` and that label must pass the slug rules (reserved
 * labels such as `www` / `admin` / `api` → null, i.e. "not an office site").
 */
export function siteSlugFromHost(host: string, rootDomain: string): string | null {
  const hostname = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const suffix = `.${rootDomain.toLowerCase().replace(/\.$/, '')}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  if (label.includes('.')) return null;
  return siteSlugProblem(label) === null ? label : null;
}

// ---------- brand colour ----------

/**
 * Preset brand colours of an office site (stored as `agency_sites.color`, a validated VARCHAR —
 * not a database enum, so the palette can change without a migration).
 */
export const AgencySiteColor = {
  BLUE: 'BLUE',
  NAVY: 'NAVY',
  GREEN: 'GREEN',
  TEAL: 'TEAL',
  RED: 'RED',
  ORANGE: 'ORANGE',
  PURPLE: 'PURPLE',
  BROWN: 'BROWN',
  BLACK: 'BLACK',
} as const;
export type AgencySiteColor = EnumValue<typeof AgencySiteColor>;

export const DEFAULT_AGENCY_SITE_COLOR: AgencySiteColor = AgencySiteColor.BLUE;

/**
 * One brand palette; the fields mirror the `--brand*` tokens of packages/ui/src/styles/tokens.css
 * (`brand` → --brand, `hover` → --brand-hover, `press` → --brand-press, `soft` → --brand-soft,
 * `soft2` → --brand-soft-2, `line` → --brand-line, `contrast` → --brand-contrast).
 * Every `brand` reaches ≥ 4.5:1 against white and against its `soft`, and stays clearly apart
 * (CIEDE2000 ≥ 10) from the colours with a fixed meaning — --danger / --up, --success, --warn,
 * the --deal-* types and --text — so a branded button never reads as an error, a 매매 label or
 * body text (unit-tested against tokens.css). Keys are stored values and never change; a preset
 * whose colour had to move keeps its key with a new hex / label (RED = 와인, ORANGE = 황토,
 * BLACK = 먹색).
 */
export interface AgencySitePalette {
  label: string;
  brand: string;
  hover: string;
  press: string;
  soft: string;
  soft2: string;
  line: string;
  contrast: string;
}

export const AGENCY_SITE_COLORS: Record<AgencySiteColor, AgencySitePalette> = {
  BLUE: {
    label: '파랑',
    brand: '#1D4FF2',
    hover: '#1539C4',
    press: '#102C99',
    soft: '#EEF3FF',
    soft2: '#DCE6FF',
    line: '#B9CCFF',
    contrast: '#FFFFFF',
  },
  NAVY: {
    label: '남색',
    brand: '#1E3A8A',
    hover: '#172F70',
    press: '#112456',
    soft: '#EEF2FA',
    soft2: '#DCE4F4',
    line: '#B4C3E6',
    contrast: '#FFFFFF',
  },
  GREEN: {
    label: '초록',
    brand: '#3F6212',
    hover: '#34500F',
    press: '#2A410C',
    soft: '#F5FAEB',
    soft2: '#E6F0D2',
    line: '#C9DCA5',
    contrast: '#FFFFFF',
  },
  TEAL: {
    label: '청록',
    brand: '#0E7490',
    hover: '#155E75',
    press: '#164E63',
    soft: '#ECFAFD',
    soft2: '#CFF1F8',
    line: '#9EDDEB',
    contrast: '#FFFFFF',
  },
  RED: {
    label: '와인',
    brand: '#8B1A2B',
    hover: '#721523',
    press: '#5C111C',
    soft: '#F7EEF0',
    soft2: '#EDDADE',
    line: '#D9B3BA',
    contrast: '#FFFFFF',
  },
  ORANGE: {
    label: '황토',
    brand: '#8A6100',
    hover: '#715000',
    press: '#5B4000',
    soft: '#FAF5E8',
    soft2: '#F1E6C8',
    line: '#E0CB92',
    contrast: '#FFFFFF',
  },
  PURPLE: {
    label: '보라',
    brand: '#9333EA',
    hover: '#7E22CE',
    press: '#6B21A8',
    soft: '#FAF5FF',
    soft2: '#F3E8FF',
    line: '#E9D5FF',
    contrast: '#FFFFFF',
  },
  BROWN: {
    label: '갈색',
    brand: '#6F4E37',
    hover: '#5B402D',
    press: '#493324',
    soft: '#F7F2EE',
    soft2: '#EDE3DA',
    line: '#D9C6B5',
    contrast: '#FFFFFF',
  },
  BLACK: {
    label: '먹색',
    brand: '#2F4F6F',
    hover: '#27415B',
    press: '#1F3449',
    soft: '#E1EAF4',
    soft2: '#CCDAEA',
    line: '#A6B9CE',
    contrast: '#FFFFFF',
  },
};

export const AGENCY_SITE_COLOR_LABEL: Record<AgencySiteColor, string> = Object.fromEntries(
  Object.entries(AGENCY_SITE_COLORS).map(([k, v]) => [k, v.label]),
) as Record<AgencySiteColor, string>;

export const agencySiteColorSchema = z.enum(AgencySiteColor, {
  error: '제공하는 색상 중에서 골라 주세요.',
});

/** Palette of a stored colour; unknown values (e.g. a colour removed later) fall back to BLUE. */
export function agencySitePalette(color: string | null | undefined): AgencySitePalette {
  return AGENCY_SITE_COLORS[color as AgencySiteColor] ?? AGENCY_SITE_COLORS.BLUE;
}

/** `--brand*` CSS custom properties of a colour, for the office-site shell root (`style={...}`). */
export function agencySiteCssVars(color: string | null | undefined): Record<string, string> {
  const p = agencySitePalette(color);
  return {
    '--brand': p.brand,
    '--brand-hover': p.hover,
    '--brand-press': p.press,
    '--brand-soft': p.soft,
    '--brand-soft-2': p.soft2,
    '--brand-line': p.line,
    '--brand-contrast': p.contrast,
    '--focus': `0 0 0 3px rgba(${hexToRgb(p.brand).join(', ')}, 0.32)`,
  };
}

/** Tagline (한 줄 소개) length limit (agency_sites.tagline VARCHAR(60)). */
export const AGENCY_SITE_TAGLINE_MAX = 60;
