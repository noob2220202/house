import { DealType, FloorDisplay } from '@house/shared';
import {
  addDays,
  dailyViews,
  dashboardPrice,
  kstDay,
  listingSummaryText,
  toDashboardListing,
  type DashboardListingRow,
} from './dashboard';

const row = (over: Partial<DashboardListingRow> = {}): DashboardListingRow => ({
  id: 'l1',
  title: null,
  assetType: 'APT',
  dealType: DealType.SALE,
  salePrice: 44500,
  deposit: null,
  monthlyRent: null,
  presalePrice: null,
  premium: null,
  floorDisplay: FloorDisplay.EXACT,
  expiresAt: null,
  verifiedAt: null,
  complex: { name: '신대 레이크파크 1단지' },
  property: { floor: 20, totalFloors: 25, exclusiveArea: 84.98, supplyArea: 112.4 },
  ...over,
});

describe('agencies dashboard domain', () => {
  it('kstDay / addDays work on KST calendar days', () => {
    expect(kstDay(new Date('2026-11-23T15:30:00Z'))).toBe('2026-11-24');
    expect(kstDay(new Date('2026-11-23T14:59:59Z'))).toBe('2026-11-23');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  describe('dailyViews', () => {
    const today = '2026-11-24';
    it('derives per-day views from cumulative snapshots, missing days count 0', () => {
      const snaps = new Map<string, number>([
        ['2026-11-17', 100],
        ['2026-11-18', 110],
        ['2026-11-19', 130],
        // 11-20 missing → 11-20 and 11-21 unknown
        ['2026-11-21', 160],
        ['2026-11-22', 165],
        ['2026-11-23', 150], // a listing left the agency: clamped at 0
        ['2026-11-24', 170],
      ]);
      const v = dailyViews(snaps, today);
      expect(v.daily.map((d) => d.date)).toEqual([
        '2026-11-18',
        '2026-11-19',
        '2026-11-20',
        '2026-11-21',
        '2026-11-22',
        '2026-11-23',
        '2026-11-24',
      ]);
      expect(v.daily.map((d) => d.views)).toEqual([10, 20, 0, 0, 5, 0, 20]);
      expect(v.total7d).toBe(55);
      // The previous week was not observed (no 11-10 / 11-17 pair) → no comparison.
      expect(v.changeRatio).toBeNull();
    });

    it('compares with the previous 7 days when both ends were observed', () => {
      const snaps = new Map<string, number>();
      for (let i = 14; i >= 0; i--) snaps.set(addDays(today, -i), (14 - i) * 10);
      // 10 views per day in both weeks → +0%.
      expect(dailyViews(snaps, today)).toMatchObject({ total7d: 70, changeRatio: 0 });
      snaps.set(today, 140 + 70); // today +80 instead of +10
      expect(dailyViews(snaps, today).changeRatio).toBe(1);
    });

    it('an empty history gives seven zero days', () => {
      const v = dailyViews(new Map(), today);
      expect(v.daily).toHaveLength(7);
      expect(v.total7d).toBe(0);
      expect(v.changeRatio).toBeNull();
    });
  });

  it('dashboardPrice follows the console money convention', () => {
    expect(dashboardPrice(row())).toEqual({ price: 44500, deposit: null, monthlyRent: null });
    expect(
      dashboardPrice(row({ dealType: DealType.PRESALE, presalePrice: 40000, premium: 1900 })),
    ).toEqual({ price: 41900, deposit: null, monthlyRent: null });
    expect(dashboardPrice(row({ dealType: DealType.JEONSE, deposit: 31000 }))).toEqual({
      price: null,
      deposit: 31000,
      monthlyRent: null,
    });
    expect(
      dashboardPrice(row({ dealType: DealType.MONTHLY, deposit: 3000, monthlyRent: 90 })),
    ).toEqual({ price: null, deposit: 3000, monthlyRent: 90 });
  });

  it('summary text: 평 from 공급면적 and the floor label', () => {
    expect(listingSummaryText(row())).toBe('34평 · 20/25층');
    expect(
      listingSummaryText(
        row({
          property: { floor: null, totalFloors: null, exclusiveArea: 59.9, supplyArea: null },
        }),
      ),
    ).toBe('18평');
    expect(listingSummaryText(row({ floorDisplay: FloorDisplay.CLASS }))).toBe('34평 · 고/25층');
  });

  it('toDashboardListing: title fallback and verification due date', () => {
    const l = toDashboardListing(
      row({
        verifiedAt: new Date('2026-11-01T03:00:00Z'),
        expiresAt: new Date('2026-12-01T03:00:00Z'),
      }),
      30,
    );
    expect(l.title).toBe('신대 레이크파크 1단지');
    expect(l.verificationDueAt).toBe('2026-12-01');
    expect(l.expiresAt).toBe('2026-12-01T03:00:00.000Z');
    expect(toDashboardListing(row({ complex: null }), 30).title).toBe('아파트 매매');
    expect(toDashboardListing(row(), 30).verificationDueAt).toBeNull();
  });
});
