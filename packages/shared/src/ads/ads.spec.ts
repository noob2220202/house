import { bannerCreateSchema, bannerUpdateSchema, popupCreateSchema } from '../schemas/ads';
import { isBotUserAgent } from './bot';
import { isSafeAdLinkUrl, resolveAdLink } from './link';
import { addDays, ctrPercent, dateRange, daysBetween, kstDate } from './stats';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

describe('isSafeAdLinkUrl', () => {
  it.each([
    'https://example.com',
    'https://example.com/path?q=1#x',
    '/listings/123',
    '/complexes?region=46150',
  ])('accepts %s', (url) => expect(isSafeAdLinkUrl(url)).toBe(true));

  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'data:text/html,<script>',
    '//evil.com',
    '/\\evil.com',
    '/%0a//evil.com x',
    'https://user:pw@example.com',
    'https://example.com/\nfoo',
    ' https://example.com',
    'example.com',
    '',
  ])('rejects %j', (url) => expect(isSafeAdLinkUrl(url)).toBe(false));
});

describe('resolveAdLink', () => {
  it('resolves relative links against the public site', () => {
    expect(resolveAdLink('/map?x=1', 'https://house.example/')).toBe(
      'https://house.example/map?x=1',
    );
  });
  it('keeps absolute https links and refuses unsafe ones', () => {
    expect(resolveAdLink('https://ad.example/a', 'https://house.example')).toBe(
      'https://ad.example/a',
    );
    expect(resolveAdLink('//evil.com', 'https://house.example')).toBeNull();
    expect(resolveAdLink('http://ad.example', 'https://house.example')).toBeNull();
  });
});

describe('isBotUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',
    'facebookexternalhit/1.1',
    'kakaotalk-scrap/1.0',
    'curl/8.5.0',
    'python-requests/2.31',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36',
    '',
    undefined,
  ])('flags %j', (ua) => expect(isBotUserAgent(ua)).toBe(true));

  it.each([
    CHROME,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.4.5',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 NAVER(inapp; search; 2000; 12.3.4)',
  ])('lets real browsers through: %s', (ua) => expect(isBotUserAgent(ua)).toBe(false));
});

describe('ad stats helpers', () => {
  it('buckets by KST day', () => {
    expect(kstDate(new Date('2026-11-30T14:59:59Z'))).toBe('2026-11-30');
    expect(kstDate(new Date('2026-11-30T15:00:00Z'))).toBe('2026-12-01');
  });
  it('walks date ranges', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dateRange('2026-02-27', '2026-03-01')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(31);
  });
  it('computes CTR in percent', () => {
    expect(ctrPercent(3, 400)).toBe(0.75);
    expect(ctrPercent(1, 3)).toBe(33.33);
    expect(ctrPercent(5, 0)).toBe(0);
  });
});

describe('ad schemas', () => {
  const base = {
    slot: 'MAIN_HERO',
    title: '배너',
    pcMediaId: '01937a2b-0000-7000-8000-000000000001',
    startAt: '2026-12-01T00:00:00+09:00',
    endAt: '2026-12-31T00:00:00+09:00',
  };

  it('applies defaults on create', () => {
    const r = bannerCreateSchema.parse(base);
    expect(r).toMatchObject({
      targeting: 'ALL',
      targetRegionCodes: [],
      paused: false,
      priority: 0,
    });
  });

  it('rejects an inverted window and inconsistent targeting', () => {
    const r = bannerCreateSchema.safeParse({
      ...base,
      endAt: base.startAt,
      targeting: 'REGIONS',
      targetComplexIds: ['01937a2b-0000-7000-8000-000000000002'],
    });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['endAt', 'targetRegionCodes', 'targetComplexIds']),
    );
  });

  it('rejects http links and dedupes target lists', () => {
    expect(bannerCreateSchema.safeParse({ ...base, linkUrl: 'http://x.com' }).success).toBe(false);
    const r = bannerCreateSchema.parse({
      ...base,
      targeting: 'REGIONS',
      targetRegionCodes: ['46150', '46150'],
    });
    expect(r.targetRegionCodes).toEqual(['46150']);
  });

  it('update requires at least one known field and allows null to clear', () => {
    expect(bannerUpdateSchema.safeParse({}).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ slot: 'MAP_AD' }).success).toBe(false);
    expect(bannerUpdateSchema.parse({ linkUrl: null })).toEqual({ linkUrl: null });
  });

  it('popup needs at least one target page', () => {
    const p = { title: '팝업', mediaId: base.pcMediaId, startAt: base.startAt, endAt: base.endAt };
    expect(popupCreateSchema.safeParse({ ...p, targetPages: [] }).success).toBe(false);
    expect(popupCreateSchema.parse({ ...p, targetPages: ['MAIN', 'MAIN'] }).targetPages).toEqual([
      'MAIN',
    ]);
  });
});
