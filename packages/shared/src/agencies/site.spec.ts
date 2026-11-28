import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, hexToRgb, relativeLuminance } from '../utils/color';
import {
  AGENCY_SITE_COLORS,
  AgencySiteColor,
  DEFAULT_AGENCY_SITE_COLOR,
  RESERVED_SITE_SLUGS,
  agencySiteColorSchema,
  agencySiteCssVars,
  agencySitePalette,
  normalizeSiteSlug,
  siteSlugFromHost,
  siteSlugMessage,
  siteSlugProblem,
  siteSlugSchema,
  siteUrl,
} from './site';
import {
  adminAgencySiteDecisionSchema,
  adminAgencySiteListQuerySchema,
  adminSubscriptionCreateSchema,
  adminSubscriptionUpdateSchema,
  agencySiteAvailabilityQuerySchema,
  agencySiteRequestSchema,
  agencySiteUpdateSchema,
} from './site-schemas';
import { subscriptionState } from './subscriptions';

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('office site slug rules', () => {
  it('normalises case and surrounding space only', () => {
    expect(normalizeSiteSlug('  Jungang-Realty ')).toBe('jungang-realty');
    expect(siteSlugSchema.parse(' Sun-Office1 ')).toBe('sun-office1');
  });

  it.each(['abc', 'a1b', 'jungang-realty', '123', 'a'.repeat(30), 'a-b-c'])('accepts %s', (s) => {
    expect(siteSlugProblem(s)).toBeNull();
    expect(siteSlugMessage(s)).toBeNull();
    expect(siteSlugSchema.safeParse(s).success).toBe(true);
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(31)],
    ['leading hyphen', '-abc'],
    ['trailing hyphen', 'abc-'],
    ['double hyphen', 'ab--cd'],
    ['punycode', 'xn--hq1bm8jm9l'],
    ['dot', 'a.bc'],
    ['underscore', 'a_bc'],
    ['space inside', 'ab cd'],
    ['한글', '순천부동산'],
    ['empty', ''],
  ])('refuses %s', (_why, s) => {
    expect(siteSlugProblem(s)).toBe('INVALID');
    expect(siteSlugMessage(s)).toMatch(/[가-힣]/);
    // The console / admin forms speak 해요체: no 합니다 / 입니다 in the field messages.
    expect(siteSlugMessage(s)).not.toMatch(/니다\./);
    expect(siteSlugSchema.safeParse(s).success).toBe(false);
  });

  it('refuses reserved labels in any case', () => {
    for (const s of ['www', 'admin', 'api', 'suncheonmap', 'Kakao', ' MAIL ', 'undefined']) {
      expect(siteSlugProblem(s)).toBe('RESERVED');
      expect(siteSlugSchema.safeParse(s).success).toBe(false);
    }
  });

  it('keeps the reserved list lower-case and in the slug alphabet (so normalising finds it)', () => {
    expect(RESERVED_SITE_SLUGS.size).toBeGreaterThan(100);
    for (const s of RESERVED_SITE_SLUGS) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it('gives a Korean zod message', () => {
    const r = siteSlugSchema.safeParse('-x');
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toMatch(/[가-힣]/);
  });
});

describe('office site hosts and URLs', () => {
  it('builds the site URL with the right scheme and port', () => {
    expect(siteUrl('jungang', 'suncheonmap.kr')).toBe('https://jungang.suncheonmap.kr');
    expect(siteUrl('Jungang', 'suncheonmap.kr', 'https', 443)).toBe(
      'https://jungang.suncheonmap.kr',
    );
    expect(siteUrl('demo1', 'localhost', 'http:', '3000')).toBe('http://demo1.localhost:3000');
    expect(siteUrl('demo1', 'localhost', 'http:', 80)).toBe('http://demo1.localhost');
    expect(siteUrl('demo1', 'localhost', 'http:', '')).toBe('http://demo1.localhost');
  });

  it('reads the slug from a host header', () => {
    expect(siteSlugFromHost('jungang.suncheonmap.kr', 'suncheonmap.kr')).toBe('jungang');
    expect(siteSlugFromHost('Jungang.SuncheonMap.kr:443', 'suncheonmap.kr')).toBe('jungang');
    expect(siteSlugFromHost('office1.localhost:3000', 'localhost')).toBe('office1');
    expect(siteSlugFromHost('suncheonmap.kr', 'suncheonmap.kr')).toBeNull();
    expect(siteSlugFromHost('www.suncheonmap.kr', 'suncheonmap.kr')).toBeNull();
    expect(siteSlugFromHost('admin.suncheonmap.kr', 'suncheonmap.kr')).toBeNull();
    expect(siteSlugFromHost('a.b.suncheonmap.kr', 'suncheonmap.kr')).toBeNull();
    expect(siteSlugFromHost('jungang.evil.kr', 'suncheonmap.kr')).toBeNull();
    expect(siteSlugFromHost('jungangsuncheonmap.kr', 'suncheonmap.kr')).toBeNull();
    expect(siteSlugFromHost('xn--hq1bm8jm9l.suncheonmap.kr', 'suncheonmap.kr')).toBeNull();
  });
});

describe('office site colours (WCAG)', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    // The design token comment: --brand on white is 6.1:1.
    expect(contrastRatio('#1d4ff2', '#ffffff')).toBeCloseTo(6.08, 1);
  });

  it('defines every preset and BLUE is the design-system brand', () => {
    expect(Object.keys(AGENCY_SITE_COLORS).sort()).toEqual(Object.values(AgencySiteColor).sort());
    expect(DEFAULT_AGENCY_SITE_COLOR).toBe('BLUE');
    expect(AGENCY_SITE_COLORS.BLUE.brand.toLowerCase()).toBe('#1d4ff2');
  });

  it.each(Object.entries(AGENCY_SITE_COLORS))('%s is readable', (_key, p) => {
    expect(p.label).toMatch(/[가-힣]/);
    for (const v of [p.brand, p.hover, p.press, p.soft, p.soft2, p.line, p.contrast]) {
      expect(v).toMatch(/^#[0-9A-F]{6}$/);
    }
    // White text on the button and brand text on white / on the soft tint.
    expect(contrastRatio(p.brand, p.contrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.brand, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.brand, p.soft)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.hover, p.contrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.press, p.contrast)).toBeGreaterThanOrEqual(4.5);
  });

  // The colours with a fixed meaning in the design system (packages/ui tokens.css): a brand
  // equal or close to one makes the main action look like an error, a 매매 label or body text.
  const tokens = readFileSync(join(__dirname, '../../../ui/src/styles/tokens.css'), 'utf8');
  const token = (name: string): string => {
    const m = new RegExp(String.raw`(?:^|[\s;{])--${name}:\s*(#[0-9a-fA-F]{6})`).exec(tokens);
    if (!m) throw new Error(`token --${name} not found`);
    return m[1]!;
  };
  const FIXED = [
    'danger',
    'up',
    'success',
    'warn',
    'deal-presale',
    'deal-monthly',
    'deal-jeonse',
    'deal-sale',
    'text',
  ];
  const FIXED_SOFT = ['danger-soft', 'success-soft', 'warn-soft', 'surface-2'];

  it('CIEDE2000 matches the reference pairs', () => {
    // Sharma, Wu & Dalal (2005) test data, pairs 1 and 17.
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
    expect(deltaE2000(lab('#c81e2c'), lab('#C81E2C'))).toBe(0);
  });

  // BLUE is the design system's own --brand (its --down partner is drawn with it).
  it.each(Object.entries(AGENCY_SITE_COLORS).filter(([k]) => k !== 'BLUE'))(
    '%s stays apart from the fixed-meaning colours',
    (_key, p) => {
      for (const name of FIXED) {
        expect([name, deltaE2000(lab(p.brand), lab(token(name))) >= 10]).toEqual([name, true]);
      }
      for (const name of FIXED_SOFT) {
        expect(p.soft.toLowerCase()).not.toBe(token(name).toLowerCase());
      }
    },
  );

  it('falls back to BLUE for an unknown stored colour and emits the --brand tokens', () => {
    expect(agencySitePalette('PINK')).toBe(AGENCY_SITE_COLORS.BLUE);
    expect(agencySitePalette(null)).toBe(AGENCY_SITE_COLORS.BLUE);
    const vars = agencySiteCssVars('GREEN');
    expect(vars['--brand']).toBe(AGENCY_SITE_COLORS.GREEN.brand);
    expect(vars['--brand-soft-2']).toBe(AGENCY_SITE_COLORS.GREEN.soft2);
    expect(vars['--focus']).toBe(
      `0 0 0 3px rgba(${hexToRgb(AGENCY_SITE_COLORS.GREEN.brand).join(', ')}, 0.32)`,
    );
    expect(agencySiteColorSchema.safeParse('PINK').success).toBe(false);
  });
});

describe('office site request schemas', () => {
  it('requests a slug with optional colour and tagline', () => {
    expect(
      agencySiteRequestSchema.parse({ slug: 'Jungang', color: 'NAVY', tagline: ' 안녕 ' }),
    ).toEqual({ slug: 'jungang', color: 'NAVY', tagline: '안녕' });
    expect(agencySiteRequestSchema.parse({ slug: 'jungang', tagline: '' }).tagline).toBeNull();
    expect(issues(agencySiteRequestSchema.safeParse({ slug: 'www' }))).toEqual(['slug']);
    expect(
      issues(agencySiteRequestSchema.safeParse({ slug: 'jungang', tagline: 'a'.repeat(61) })),
    ).toEqual(['tagline']);
    expect(issues(agencySiteRequestSchema.safeParse({ slug: 'jungang', color: 'PINK' }))).toEqual([
      'color',
    ]);
  });

  it('updates colour / tagline, at least one', () => {
    expect(agencySiteUpdateSchema.parse({ tagline: null })).toEqual({ tagline: null });
    expect(agencySiteUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('checks availability with the raw slug', () => {
    expect(agencySiteAvailabilityQuerySchema.parse({ slug: ' -Bad ' })).toEqual({ slug: '-Bad' });
    expect(agencySiteAvailabilityQuerySchema.safeParse({ slug: '' }).success).toBe(false);
  });

  it('admin decisions: reason for REJECT / SUSPEND, slug only on APPROVE', () => {
    expect(adminAgencySiteDecisionSchema.parse({ action: 'APPROVE', slug: 'Jungang' })).toEqual({
      action: 'APPROVE',
      slug: 'jungang',
    });
    expect(adminAgencySiteDecisionSchema.safeParse({ action: 'RESUME' }).success).toBe(true);
    expect(issues(adminAgencySiteDecisionSchema.safeParse({ action: 'REJECT' }))).toEqual([
      'reason',
    ]);
    expect(
      issues(adminAgencySiteDecisionSchema.safeParse({ action: 'SUSPEND', reason: ' ' })),
    ).toEqual(['reason']);
    expect(
      issues(
        adminAgencySiteDecisionSchema.safeParse({ action: 'REJECT', reason: '중복', slug: 'abc' }),
      ),
    ).toEqual(['slug']);
    expect(
      issues(adminAgencySiteDecisionSchema.safeParse({ action: 'APPROVE', slug: 'admin' })),
    ).toEqual(['slug']);
    expect(adminAgencySiteDecisionSchema.safeParse({ action: 'DELETE' }).success).toBe(false);
    expect(
      adminAgencySiteDecisionSchema.safeParse({ action: 'REJECT', reason: 'a'.repeat(501) })
        .success,
    ).toBe(false);
  });

  it('admin site list query', () => {
    expect(adminAgencySiteListQuerySchema.parse({ status: 'REQUESTED' })).toEqual({
      status: 'REQUESTED',
      page: 1,
      pageSize: 20,
    });
    expect(adminAgencySiteListQuerySchema.safeParse({ status: 'OPEN' }).success).toBe(false);
  });
});

describe('subscriptions', () => {
  it('records a period with an inclusive end on or after the start', () => {
    const ok = adminSubscriptionCreateSchema.parse({
      product: 'SITE',
      startsOn: '2026-12-01',
      endsOn: '2026-12-01',
      amountWon: 30000,
      memo: ' 12월분 입금 ',
    });
    expect(ok).toEqual({
      product: 'SITE',
      startsOn: '2026-12-01',
      endsOn: '2026-12-01',
      amountWon: 30000,
      memo: '12월분 입금',
    });
    expect(
      adminSubscriptionCreateSchema.parse({ product: 'PLATFORM', startsOn: '2026-12-01' }),
    ).toEqual({
      product: 'PLATFORM',
      startsOn: '2026-12-01',
    });
    expect(
      issues(
        adminSubscriptionCreateSchema.safeParse({
          product: 'SITE',
          startsOn: '2026-12-02',
          endsOn: '2026-12-01',
        }),
      ),
    ).toEqual(['endsOn']);
    expect(
      issues(adminSubscriptionCreateSchema.safeParse({ product: 'SITE', startsOn: '2026/12/01' })),
    ).toEqual(['startsOn']);
    expect(
      issues(
        adminSubscriptionCreateSchema.safeParse({
          product: 'SITE',
          startsOn: '2026-12-01',
          amountWon: -1,
        }),
      ),
    ).toEqual(['amountWon']);
    expect(
      issues(
        adminSubscriptionCreateSchema.safeParse({
          product: 'SITE',
          startsOn: '2026-12-01',
          amountWon: 1.5,
        }),
      ),
    ).toEqual(['amountWon']);
    // Over the ceiling: its own message, not the integer one.
    const tooMuch = adminSubscriptionCreateSchema.safeParse({
      product: 'SITE',
      startsOn: '2026-12-01',
      amountWon: 2_000_000_000,
    });
    expect(tooMuch.error?.issues.map((i) => i.message)).toEqual([
      '금액은 10억 원 이하로 입력해 주세요.',
    ]);
    expect(
      adminSubscriptionCreateSchema.safeParse({
        product: 'SITE',
        startsOn: '2026-12-01',
        amountWon: 1_000_000_000,
      }).success,
    ).toBe(true);
  });

  it('updates end / memo / cancel, at least one', () => {
    expect(adminSubscriptionUpdateSchema.parse({ cancel: true })).toEqual({ cancel: true });
    expect(adminSubscriptionUpdateSchema.parse({ endsOn: null })).toEqual({ endsOn: null });
    expect(adminSubscriptionUpdateSchema.safeParse({ cancel: false }).success).toBe(false);
    expect(adminSubscriptionUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('derives the state in KST days', () => {
    const p = { startsOn: '2026-12-01', endsOn: '2026-12-31', canceledAt: null };
    expect(subscriptionState(p, '2026-11-30')).toBe('SCHEDULED');
    expect(subscriptionState(p, '2026-12-01')).toBe('ACTIVE');
    expect(subscriptionState(p, '2026-12-31')).toBe('ACTIVE');
    expect(subscriptionState(p, '2027-01-01')).toBe('ENDED');
    expect(subscriptionState({ ...p, endsOn: null }, '2030-01-01')).toBe('ACTIVE');
    expect(subscriptionState({ ...p, canceledAt: '2026-12-05T00:00:00Z' }, '2026-12-10')).toBe(
      'CANCELED',
    );
  });
});

/** CIE L*a*b* (D65) of an sRGB hex colour. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIEDE2000 colour difference (≈ 2 just noticeable, ≥ 10 clearly different colours). */
function deltaE2000(
  [l1, a1, b1]: [number, number, number],
  [l2, a2, b2]: [number, number, number],
): number {
  const rad = Math.PI / 180;
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) =>
    b === 0 && a === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360;
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  let dh = h2p - h1p;
  if (c1p * c2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = l2 - l1;
  const dC = c2p - c1p;
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh * rad) / 2);
  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBar = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hBar += h1p + h2p < 360 ? 360 : -360;
    hBar /= 2;
  }
  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * rad) +
    0.24 * Math.cos(2 * hBar * rad) +
    0.32 * Math.cos((3 * hBar + 6) * rad) -
    0.2 * Math.cos((4 * hBar - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(2 * dTheta * rad) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}
