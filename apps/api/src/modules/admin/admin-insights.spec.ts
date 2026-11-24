import { AgencyDocumentType, DEAL_TYPE_LABEL, DealType } from '@house/shared';
import { Prisma } from '@prisma/client';
import { adminSearchQuerySchema, normalizeSearch, statsQuerySchema } from './schemas';
import {
  documentChecklist,
  listingHeadline,
  maskName,
  priceFields,
  priceText,
  pyeongLabel,
} from './services/admin-format';
import { daysUntil } from './services/admin-notifications.service';
import { registrationKeyOf, searchVariants } from './services/admin-search.service';
import { kstIsoDate, splitSeries, statsWindow } from './services/admin-stats.service';
import { averageHandleHours, ctrOf, startOfKstWeek } from './services/dashboard-queues.service';
import { maskClientId } from './services/social-login-status.service';
import { deviceClassOf } from './visitors/visitor-stats.service';

const HOUR = 3_600_000;

describe('admin search query', () => {
  it('needs 2 characters besides spaces and hyphens; limit 1–20, default 8', () => {
    expect(adminSearchQuerySchema.safeParse({ q: ' - ' }).success).toBe(false);
    expect(adminSearchQuerySchema.safeParse({ q: '가' }).success).toBe(false);
    expect(adminSearchQuerySchema.safeParse({}).success).toBe(false);
    expect(adminSearchQuerySchema.parse({ q: ' 연향 ' })).toEqual({ q: '연향', limit: 8 });
    expect(adminSearchQuerySchema.parse({ q: '연향', limit: '3' }).limit).toBe(3);
    expect(adminSearchQuerySchema.safeParse({ q: '연향', limit: '21' }).success).toBe(false);
    const fail = adminSearchQuerySchema.safeParse({ q: 'a' });
    expect(fail.error?.issues[0]?.message).toBe('검색어를 2자 이상 입력해 주세요.');
  });

  it('normalises and builds variants / registration keys', () => {
    expect(normalizeSearch('신대 레이크-파크')).toBe('신대레이크파크');
    expect(searchVariants('신대 레이크')).toEqual(['신대 레이크', '신대레이크']);
    expect(searchVariants('연향')).toEqual(['연향']);
    expect(registrationKeyOf('제46150-2019-00012호')).toBe('제46150201900012호');
  });
});

describe('stats query and windows', () => {
  it('days ∈ {7, 30, 90}, default 30', () => {
    expect(statsQuerySchema.parse({})).toEqual({ days: 30 });
    expect(statsQuerySchema.parse({ days: '7' })).toEqual({ days: 7 });
    expect(statsQuerySchema.safeParse({ days: '14' }).success).toBe(false);
  });

  it('a window is 2 × days KST days ending today; the first half is the previous period', () => {
    // 2026-11-24 00:30 KST = 2026-11-23 15:30 UTC
    const now = new Date('2026-11-23T15:30:00Z');
    expect(kstIsoDate(now)).toBe('2026-11-24');
    const w = statsWindow(7, now);
    expect(w.dates).toHaveLength(7);
    expect(w.dates.at(-1)).toBe('2026-11-24');
    expect(w.dates[0]).toBe('2026-11-18');
    expect(w.previousDates).toEqual([
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
    ]);
    expect(w.to.toISOString()).toBe('2026-11-24T15:00:00.000Z');
    expect(w.mid.toISOString()).toBe('2026-11-17T15:00:00.000Z');
  });

  it('splitSeries zero-fills points and sums the previous period', () => {
    const w = { previousDates: ['d1', 'd2'], dates: ['d3', 'd4'] };
    const by = new Map<string, Partial<Record<'a' | 'b', number>>>([
      ['d1', { a: 1 }],
      ['d2', { a: 2, b: 5 }],
      ['d4', { b: 3 }],
    ]);
    expect(splitSeries(w, by, ['a', 'b'] as const)).toEqual({
      points: [
        { date: 'd3', a: 0, b: 0 },
        { date: 'd4', a: 0, b: 3 },
      ],
      previous: { a: 3, b: 5 },
    });
  });
});

describe('dashboard queue helpers', () => {
  it('KST week starts on Monday 00:00', () => {
    // Sunday 2026-11-29 23:00 KST
    expect(startOfKstWeek(new Date('2026-11-29T14:00:00Z')).toISOString()).toBe(
      '2026-11-22T15:00:00.000Z',
    );
    // Monday 2026-11-23 00:10 KST
    expect(startOfKstWeek(new Date('2026-11-22T15:10:00Z')).toISOString()).toBe(
      '2026-11-22T15:00:00.000Z',
    );
  });

  it('average handling hours (1 decimal) and CTR', () => {
    const t = new Date('2026-11-20T00:00:00Z');
    expect(averageHandleHours([])).toBeNull();
    expect(
      averageHandleHours([
        { createdAt: t, handledAt: new Date(t.getTime() + 2 * HOUR) },
        { createdAt: t, handledAt: new Date(t.getTime() + 5 * HOUR) },
        { createdAt: t, handledAt: null },
      ]),
    ).toBe(3.5);
    expect(ctrOf(0, 0)).toBeNull();
    expect(ctrOf(1000, 23)).toBe(0.023);
    expect(ctrOf(10, 20)).toBe(1);
  });

  it('document checklist follows the admin app (등록증 + 사업자등록증)', () => {
    expect(documentChecklist([AgencyDocumentType.REGISTRATION_CERT])).toEqual({
      submitted: 1,
      required: 2,
      missing: [AgencyDocumentType.BUSINESS_REG_CERT],
      missingLabel: null,
    });
    expect(
      documentChecklist([
        AgencyDocumentType.REGISTRATION_CERT,
        AgencyDocumentType.BUSINESS_REG_CERT,
        AgencyDocumentType.OTHER,
      ]).missing,
    ).toEqual([]);
  });
});

describe('formatting', () => {
  it('masks names, labels sizes and builds headlines', () => {
    expect(maskName('김서진')).toBe('김*진');
    expect(maskName('한결')).toBe('한*');
    expect(maskName(null)).toBeNull();
    expect(pyeongLabel(new Prisma.Decimal(84.97))).toBe('26평');
    expect(pyeongLabel(null)).toBeNull();
    expect(listingHeadline({ title: '  정남향 로열층 ' })).toBe('정남향 로열층');
    expect(
      listingHeadline({
        title: null,
        exclusiveArea: 112.4,
        complex: { name: '신대 레이크파크 1단지' },
        property: { buildingName: null, roadAddress: '순천시 …' },
      }),
    ).toBe('신대 레이크파크 1단지 · 34평');
    expect(
      listingHeadline({ title: null, property: { buildingName: null, roadAddress: '중앙로 1' } }),
    ).toBe('중앙로 1');
  });

  it('price fields per deal type', () => {
    const p = { salePrice: 31000, presalePrice: 40000, deposit: 2000, monthlyRent: 65 };
    expect(priceFields(DealType.SALE, p)).toEqual({
      price: 31000,
      deposit: null,
      monthlyRent: null,
    });
    expect(priceFields(DealType.PRESALE, p).price).toBe(40000);
    expect(priceFields(DealType.JEONSE, p)).toEqual({
      price: null,
      deposit: 2000,
      monthlyRent: null,
    });
    expect(priceFields(DealType.MONTHLY, p)).toEqual({
      price: null,
      deposit: 2000,
      monthlyRent: 65,
    });
    expect(priceText(DealType.SALE, p, DEAL_TYPE_LABEL)).toBe(`${DEAL_TYPE_LABEL.SALE} 3억 1,000`);
    expect(priceText(DealType.MONTHLY, p, DEAL_TYPE_LABEL)).toBe(
      `${DEAL_TYPE_LABEL.MONTHLY} 2,000/65`,
    );
    expect(priceText(DealType.SALE, {}, DEAL_TYPE_LABEL)).toBeNull();
  });

  it('KST days until an end (at least 1)', () => {
    const now = new Date('2026-11-24T01:00:00Z'); // 10:00 KST
    expect(daysUntil(new Date('2026-11-24T10:00:00Z'), now)).toBe(1); // 19:00 the same day
    expect(daysUntil(new Date('2026-11-26T14:59:00Z'), now)).toBe(2); // 23:59 KST on the 26th
    expect(daysUntil(new Date('2026-11-27T03:00:00Z'), now)).toBe(3);
  });

  it('masks OAuth client ids and keeps the Google suffix', () => {
    expect(maskClientId(undefined)).toBeNull();
    expect(maskClientId('7f3c1234567890abcdefa91e')).toBe('7f3c••••••••••••••••a91e');
    expect(maskClientId('4821-abcdefgh.apps.googleusercontent.com')).toBe(
      '4821•••••••••.apps.googleusercontent.com',
    );
    expect(maskClientId('short')).toBe('•••••');
  });

  it('classifies devices from the user agent', () => {
    expect(
      deviceClassOf(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      ),
    ).toBe('mobile');
    expect(deviceClassOf('Mozilla/5.0 (Linux; Android 15; SM-S928N) Chrome/130.0 Mobile')).toBe(
      'mobile',
    );
    expect(deviceClassOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0')).toBe('desktop');
    expect(deviceClassOf(null)).toBe('desktop');
  });
});
