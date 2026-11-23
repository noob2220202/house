import { TradeDealType, TradeSyncKind } from '@house/shared';
import {
  normalizeTradeBatch,
  normalizeTradeItem,
  parseCancelDay,
  parseManwon,
} from './trade-normalizer';

const sale = {
  aptDong: '101',
  aptNm: '연향부영3차',
  aptSeq: '46150-1001',
  buildYear: '1998',
  dealAmount: '18,500',
  dealDay: '3',
  dealMonth: '10',
  dealYear: '2024',
  excluUseAr: '84.9775',
  floor: '7',
  jibun: '01234-0005',
  sggCd: '46150',
  umdCd: '11400',
  umdNm: '연향동',
};

describe('trade normalizer', () => {
  it('parses money and 해제 dates', () => {
    expect(parseManwon(' 18,500 ')).toBe(18500);
    expect(parseManwon('abc')).toBeNull();
    expect(parseCancelDay('24.10.15')?.toISOString()).toBe('2024-10-15T00:00:00.000Z');
    expect(parseCancelDay('20241015')?.toISOString()).toBe('2024-10-15T00:00:00.000Z');
    expect(parseCancelDay('24.02.30')).toBeNull();
  });

  it('normalizes a 매매 row', () => {
    const r = normalizeTradeItem(TradeSyncKind.APT_TRADE, sale, '46150');
    if (!r.ok) throw new Error(r.reason);
    expect(r.trade).toMatchObject({
      dealType: TradeDealType.SALE,
      price: 18500,
      exclusiveArea: 84.98,
      dealYm: 202410,
      floor: 7,
      jibun: '1234-5',
      emdCode: '46150114',
      emdName: '연향동',
      aptSeq: '46150-1001',
      builtYear: 1998,
      cancelled: false,
      cancelledAt: null,
    });
    expect(r.trade.dealDate.toISOString()).toBe('2024-10-03T00:00:00.000Z');
  });

  it('classifies 전세 vs 월세 and accepts legacy Korean tags', () => {
    const jeonse = normalizeTradeItem(
      TradeSyncKind.APT_RENT,
      {
        아파트: '현대',
        년: '2024',
        월: '9',
        일: '1',
        전용면적: '59.8',
        보증금액: '12,000',
        월세금액: '0',
        법정동: '조례동',
      },
      '46150',
    );
    const monthly = normalizeTradeItem(
      TradeSyncKind.APT_RENT,
      {
        aptNm: '현대',
        dealYear: '2024',
        dealMonth: '9',
        dealDay: '1',
        excluUseAr: '59.8',
        deposit: '2,000',
        monthlyRent: '45',
      },
      '46150',
    );
    expect(jeonse.ok && jeonse.trade).toMatchObject({
      dealType: 'JEONSE',
      deposit: 12000,
      monthlyRent: 0,
      dealYm: 202409,
    });
    expect(monthly.ok && monthly.trade).toMatchObject({
      dealType: 'MONTHLY',
      deposit: 2000,
      monthlyRent: 45,
    });
  });

  it('keeps the identity stable when a trade is later cancelled (해제)', () => {
    const before = normalizeTradeBatch(TradeSyncKind.APT_TRADE, [sale], '46150').trades[0];
    const after = normalizeTradeBatch(
      TradeSyncKind.APT_TRADE,
      [{ ...sale, cdealType: 'O', cdealDay: '24.11.02', rgstDate: '24.11.01' }],
      '46150',
    ).trades[0];
    expect(after?.sourceKey).toBe(before?.sourceKey);
    expect(after?.cancelled).toBe(true);
    expect(after?.cancelledAt?.toISOString()).toBe('2024-11-02T00:00:00.000Z');
    expect(before?.sourceKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives identical contracts distinct deterministic keys and skips invalid rows', () => {
    const run = () =>
      normalizeTradeBatch(
        TradeSyncKind.APT_TRADE,
        [
          sale,
          { ...sale },
          { ...sale, dealAmount: 'x' },
          { ...sale, aptNm: '' },
          { ...sale, dealMonth: '13' },
        ],
        '46150',
      );
    const a = run();
    const b = run();
    expect(a.trades).toHaveLength(2);
    expect(a.skipped.map((s) => s.reason)).toEqual([
      'invalid dealAmount',
      'missing aptNm',
      'invalid deal date',
    ]);
    expect(new Set(a.trades.map((t) => t.sourceKey)).size).toBe(2);
    expect(a.trades.map((t) => t.sourceKey)).toEqual(b.trades.map((t) => t.sourceKey));
  });
});
