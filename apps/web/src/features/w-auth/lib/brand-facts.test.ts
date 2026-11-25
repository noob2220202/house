import { AssetType, DealType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { listingSummarySchema, type ListingSummaryInput } from '@/lib/api/schemas/listing';
import type { SeoTradeReport } from '@/lib/seo/schemas';
import { formatYearMonth, listingAreaText, toBrandPanelFacts } from './brand-facts';

const listing = (over: Partial<ListingSummaryInput> = {}) =>
  listingSummarySchema.parse({
    id: 'L1',
    assetType: AssetType.APT,
    dealType: DealType.SALE,
    complexName: '해룡 중앙 아파트',
    dong: '103',
    exclusiveArea: 84.97,
    floorLabel: '고/25',
    salePrice: 41_000,
    verifiedAt: '2026-11-20T03:00:00Z',
    agencyCount: 2,
    ...over,
  });

const report = (over: Partial<SeoTradeReport> = {}): SeoTradeReport =>
  ({
    sggCode: '12150',
    regionName: '순천시',
    yearMonth: 202610,
    latestYearMonth: 202610,
    availableMonths: [202610],
    topComplexes: [
      { complexId: 'C9', name: '연향 아파트', emdName: '연향동', count: 7, medianPrice: 30_500 },
    ],
    ...over,
  }) as SeoTradeReport;

describe('toBrandPanelFacts', () => {
  it('shows the real verified listing: name, 면적, 거래, 가격, 확인일 — never 동/호', () => {
    const facts = toBrandPanelFacts({ listing: listing(), report: report(), agencyCount: 41 });
    expect(facts.highlight).toEqual({
      kind: 'listing',
      title: '해룡 중앙 아파트',
      area: '전용 85㎡(26평)',
      deal: 'sale',
      dealLabel: '매매',
      price: '4억 1,000',
      verifiedDate: '26.11.20',
      brokerCount: 2,
    });
    expect(JSON.stringify(facts.highlight)).not.toContain('103');
    expect(facts.agencyCount).toBe(41);
  });

  it('never uses the broker headline as the name (it may carry 동/호)', () => {
    const facts = toBrandPanelFacts({
      listing: listing({ complexName: null, title: '103동 1502호 로얄층 급매', emdName: '연향동' }),
      report: undefined,
      agencyCount: null,
    });
    expect(facts.highlight?.title).toBe('연향동 아파트');
    expect(JSON.stringify(facts.highlight)).not.toContain('103');
    expect(JSON.stringify(facts.highlight)).not.toContain('1502');
  });

  it('never presents an unverified listing as 실매물 확인 — falls back to the 실거래 report', () => {
    const facts = toBrandPanelFacts({
      listing: listing({ verifiedAt: null }),
      report: report(),
      agencyCount: 3,
    });
    expect(facts.highlight).toEqual({
      kind: 'trade',
      title: '연향 아파트',
      emdName: '연향동',
      monthLabel: '2026년 10월',
      tradeCount: 7,
      medianPrice: '3억 500',
    });
  });

  it('skips report rows without a median price', () => {
    const facts = toBrandPanelFacts({
      listing: undefined,
      report: report({
        topComplexes: [
          { complexId: null, name: 'A', emdName: null, count: 2, medianPrice: null },
          { complexId: 'C2', name: 'B', emdName: null, count: 1, medianPrice: 20_000 },
        ],
      }),
      agencyCount: null,
    });
    expect(facts.highlight?.title).toBe('B');
  });

  it('has nothing to show without data (no listing, no trades, no offices)', () => {
    expect(toBrandPanelFacts({ listing: undefined, report: null, agencyCount: undefined })).toEqual(
      { highlight: null, agencyCount: null },
    );
    expect(
      toBrandPanelFacts({
        listing: undefined,
        report: report({ topComplexes: [] }),
        agencyCount: 0,
      }),
    ).toEqual({ highlight: null, agencyCount: null });
  });
});

describe('helpers', () => {
  it('formats the area with the legal unit first', () => {
    expect(listingAreaText({ exclusiveArea: null, supplyArea: 112.4, landArea: null })).toBe(
      '공급 112㎡(34평)',
    );
    expect(listingAreaText({ exclusiveArea: null, supplyArea: null, landArea: null })).toBe('');
  });

  it('formats 계약월', () => {
    expect(formatYearMonth(202601)).toBe('2026년 1월');
  });
});
