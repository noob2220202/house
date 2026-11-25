import { ComplexDataSource, TradeSyncKind } from '@house/shared';
import { SUNCHEON_REGIONS, SUNCHEON_SGG } from '../regions/suncheon-regions.data';
import { parseTradeApiResponse } from '../trade-sync/trade-api.parser';
import {
  aggregateMonth,
  buildCandidates,
  clusterAreas,
  mergeMonths,
  pickHit,
  planCandidates,
  RegionIndex,
  roadAddressOf,
  type Candidate,
  type ExistingComplex,
} from './complex-bootstrap.planner';

const regions = new RegionIndex('12150', SUNCHEON_SGG.name, SUNCHEON_REGIONS);

/** A 국토교통부 XML page with these <item> field maps. */
function page(items: Record<string, string>[]): string {
  const body = items
    .map(
      (i) =>
        `<item>${Object.entries(i)
          .map(([k, v]) => `<${k}>${v}</${k}>`)
          .join('')}</item>`,
    )
    .join('');
  return `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${body}</items><totalCount>${items.length}</totalCount></body></response>`;
}

const sale = (over: Record<string, string>) => ({
  sggCd: '12150',
  dealYear: '2024',
  dealMonth: '10',
  dealDay: '3',
  dealAmount: '18,500',
  floor: '5',
  ...over,
});
const rent = (over: Record<string, string>) => ({
  sggCd: '12150',
  dealYear: '2024',
  dealMonth: '10',
  dealDay: '5',
  deposit: '12,000',
  monthlyRent: '0',
  floor: '3',
  ...over,
});

const BUYOUNG = {
  aptNm: '연향부영3차',
  umdCd: '11400',
  umdNm: '연향동',
  jibun: '1234-5',
  buildYear: '1998',
};

function aggregate(kind: TradeSyncKind, ym: number, items: Record<string, string>[]) {
  return aggregateMonth(kind, ym, parseTradeApiResponse(page(items)).items, '12150');
}

function candidatesOf(...months: ReturnType<typeof aggregate>[]) {
  const merged = mergeMonths(months);
  return { ...buildCandidates(merged.groups, regions), ambiguous: merged.ambiguous };
}

const existing = (
  over: Partial<ExistingComplex> & { id: string; name: string },
): ExistingComplex => ({
  emdCode: null,
  emdName: null,
  jibun: null,
  jibunAddress: null,
  roadAddress: null,
  externalCode: null,
  builtYear: null,
  deleted: false,
  areaTypes: [],
  ...over,
});

describe('단지 bootstrap planner', () => {
  describe('grouping', () => {
    it('groups by canonical aptSeq: a legacy 46150- code is the same 단지 as 12150-', () => {
      const oct = aggregate(TradeSyncKind.APT_TRADE, 202410, [
        sale({ ...BUYOUNG, aptSeq: '46150-1001', excluUseAr: '84.97' }),
        sale({ ...BUYOUNG, aptSeq: '12150-1001', excluUseAr: '84.98', aptNm: '연향 부영3차' }),
      ]);
      const nov = aggregate(TradeSyncKind.APT_TRADE, 202411, [
        sale({ ...BUYOUNG, aptSeq: '12150-1001', excluUseAr: '59.84', dealMonth: '11' }),
        sale({ ...BUYOUNG, aptSeq: '12150-1001', excluUseAr: '84.97', dealMonth: '11' }),
      ]);
      const { candidates, skipped } = candidatesOf(oct, nov);
      expect(skipped).toEqual([]);
      expect(candidates).toHaveLength(1);
      const [c] = candidates;
      expect(c).toMatchObject({
        externalCode: '12150-1001',
        name: '연향부영3차',
        emdCode: '12150114',
        emdName: '연향동',
        emdLabel: '연향동',
        jibun: '1234-5',
        jibunAddress: '순천시 연향동 1234-5',
        roadAddress: null,
        builtYear: 1998,
        saleCount: 4,
        rentCount: 0,
      });
      // 84.97 / 84.98 are one 평형 (the most traded value represents it)
      expect(c?.areas).toEqual([
        { exclusiveArea: 59.84, rows: 1, typeName: '59' },
        { exclusiveArea: 84.97, rows: 3, typeName: '84' },
      ]);
    });

    it('attaches 전월세 rows without aptSeq to the 단지 with the same 법정동 + 지번', () => {
      const trade = aggregate(TradeSyncKind.APT_TRADE, 202410, [
        sale({ ...BUYOUNG, aptSeq: '12150-1001', excluUseAr: '84.97' }),
      ]);
      const rents = aggregate(TradeSyncKind.APT_RENT, 202410, [
        rent({ aptNm: '연향부영3차', umdNm: '연향동', jibun: '1234-5', excluUseAr: '84.97' }),
        rent({ aptNm: '부영3차', umdNm: '연향동', jibun: '1234-5', excluUseAr: '49.5' }),
        // a 단지 that only ever shows up in 전월세 (임대): its own candidate, without a code
        rent({ aptNm: '조례주공', umdNm: '조례동', jibun: '700', excluUseAr: '39.6' }),
      ]);
      const { candidates } = candidatesOf(trade, rents);
      expect(candidates.map((c) => [c.name, c.externalCode, c.saleCount, c.rentCount])).toEqual([
        ['연향부영3차', '12150-1001', 1, 2],
        ['조례주공', null, 0, 1],
      ]);
      expect(candidates[0]?.areas.map((a) => a.exclusiveArea)).toEqual([49.5, 84.97]);
      expect(candidates[1]).toMatchObject({
        emdCode: '12150133',
        jibunAddress: '순천시 조례동 700',
      });
    });

    it('drops invalid rows (no name, bad area / price) and counts them', () => {
      const agg = aggregate(TradeSyncKind.APT_TRADE, 202410, [
        sale({ ...BUYOUNG, aptSeq: '12150-1001', excluUseAr: '84.97' }),
        sale({ umdNm: '연향동', excluUseAr: '84.97' }),
        sale({ ...BUYOUNG, aptNm: '깨진행', excluUseAr: 'abc' }),
        sale({ ...BUYOUNG, aptNm: '깨진값', excluUseAr: '84', dealAmount: 'abc' }),
      ]);
      expect(agg).toMatchObject({ rows: 1, invalid: 3 });
      expect(agg.groups).toHaveLength(1);
    });
  });

  describe('regions and addresses', () => {
    it('maps sggCd + umdCd to the verified 법정동: a 리 is filed under its 읍면', () => {
      const agg = aggregate(TradeSyncKind.APT_TRADE, 202410, [
        sale({
          aptNm: '신대중흥S-클래스',
          aptSeq: '12150-9',
          umdCd: '31022',
          umdNm: '신대리',
          jibun: '1990',
          excluUseAr: '84.99',
          buildYear: '2015',
          roadNm: '신대1로',
          roadNmBonbun: '00130',
          roadNmBubun: '00000',
        }),
      ]);
      const [c] = candidatesOf(agg).candidates;
      expect(c).toMatchObject({
        emdCode: '12150310',
        emdName: '신대리',
        emdLabel: '해룡면 신대리',
        jibunAddress: '순천시 해룡면 신대리 1990',
        roadAddress: '순천시 신대1로 130',
      });
    });

    it('falls back to umdNm by name when umdCd is missing, skips unknown 법정동', () => {
      const agg = aggregate(TradeSyncKind.APT_TRADE, 202410, [
        sale({
          aptNm: '조례현대',
          aptSeq: '12150-2002',
          umdNm: '조례동',
          jibun: '1700',
          excluUseAr: '101.9',
        }),
        sale({
          aptNm: '해룡리단지',
          aptSeq: '12150-3',
          umdNm: '해룡면 신대리',
          jibun: '5',
          excluUseAr: '59',
        }),
        // 신성리 exists under 승주읍 and 해룡면: ambiguous by name alone
        sale({ aptNm: '어딘가', aptSeq: '12150-4', umdNm: '신성리', jibun: '1', excluUseAr: '59' }),
        sale({
          aptNm: '없는동',
          aptSeq: '12150-5',
          umdCd: '99900',
          umdNm: '없는동',
          excluUseAr: '59',
        }),
      ]);
      const { candidates, skipped } = candidatesOf(agg);
      expect(candidates.map((c) => [c.name, c.emdCode, c.emdLabel])).toEqual([
        ['조례현대', '12150133', '조례동'],
        ['해룡리단지', '12150310', '해룡면 신대리'],
      ]);
      expect(skipped.map((s) => [s.name, s.reason])).toEqual([
        ['어딘가', '서비스 지역의 법정동을 확인할 수 없어요'],
        ['없는동', '서비스 지역의 법정동을 확인할 수 없어요'],
      ]);
    });

    it('builds the road address only from a complete roadNm + 본번', () => {
      expect(
        roadAddressOf({ roadNm: '연향번영길', roadNmBonbun: '00100', roadNmBubun: '00002' }),
      ).toBe('연향번영길 100-2');
      expect(roadAddressOf({ roadNm: '연향번영길', roadNmBonbun: '' })).toBeNull();
      expect(roadAddressOf({ roadNmBonbun: '00100' })).toBeNull();
    });

    it('keeps the same name in two 동 as two 단지', () => {
      const agg = aggregate(TradeSyncKind.APT_TRADE, 202410, [
        sale({
          aptNm: '현대',
          aptSeq: '12150-11',
          umdCd: '13200',
          umdNm: '왕지동',
          jibun: '10',
          excluUseAr: '84.9',
        }),
        sale({
          aptNm: '현대',
          aptSeq: '12150-12',
          umdCd: '13300',
          umdNm: '조례동',
          jibun: '20',
          excluUseAr: '84.9',
        }),
      ]);
      const { candidates } = candidatesOf(agg);
      expect(candidates.map((c) => [c.name, c.emdLabel])).toEqual([
        ['현대', '왕지동'],
        ['현대', '조례동'],
      ]);
      // an admin-made 현대 in 조례동 (no code yet) is that one; 왕지동 stays a new 단지
      const plan = planCandidates(
        candidates,
        [existing({ id: 'admin-jorye', name: '조례 현대아파트', emdCode: '12150133' })],
        regions,
      );
      expect(plan.map((p) => [p.candidate.emdLabel, p.action, p.complexId])).toEqual([
        ['왕지동', 'CREATE', null],
        ['조례동', 'UPDATE', 'admin-jorye'],
      ]);
      expect(plan[1]?.patch).toMatchObject({ externalCode: '12150-12', jibun: '20' });
    });
  });

  describe('평형', () => {
    it('clusters rounding noise and names 평형 sharing the integer ㎡ A/B', () => {
      expect(
        clusterAreas({ '59.84': 3, '59.9': 1, '84.1': 2, '84.97': 5, '84.98': 1, '114.9': 1 }),
      ).toEqual([
        { exclusiveArea: 59.84, rows: 4, typeName: '59' },
        { exclusiveArea: 84.1, rows: 2, typeName: '84A' },
        { exclusiveArea: 84.97, rows: 6, typeName: '84B' },
        { exclusiveArea: 114.9, rows: 1, typeName: '114' },
      ]);
    });
  });

  describe('plan (idempotency, admin edits)', () => {
    const cand = (over: Partial<Candidate> = {}): Candidate => ({
      key: 's:12150-1001',
      externalCode: '12150-1001',
      name: '연향부영3차',
      emdCode: '12150114',
      emdName: '연향동',
      emdLabel: '연향동',
      jibun: '1234-5',
      jibunAddress: '순천시 연향동 1234-5',
      roadAddress: '순천시 연향번영길 100',
      builtYear: 1998,
      areas: [
        { exclusiveArea: 59.84, rows: 1, typeName: '59' },
        { exclusiveArea: 84.97, rows: 3, typeName: '84' },
      ],
      saleCount: 4,
      rentCount: 0,
      ...over,
    });

    it('a second run finds the 단지 it created by externalCode and changes nothing', () => {
      const [item] = planCandidates(
        [cand()],
        [
          existing({
            id: 'made',
            name: '연향부영3차',
            externalCode: '46150-1001',
            emdCode: '12150114',
            emdName: '연향동',
            jibun: '1234-5',
            jibunAddress: '순천시 연향동 1234-5',
            roadAddress: '순천시 연향번영길 100',
            builtYear: 1998,
            areaTypes: [
              { exclusiveArea: 59.84, typeName: '59', source: ComplexDataSource.TRADE_BOOTSTRAP },
              { exclusiveArea: 84.98, typeName: '84', source: ComplexDataSource.TRADE_BOOTSTRAP },
            ],
          }),
        ],
      );
      expect(item).toMatchObject({
        action: 'UNCHANGED',
        complexId: 'made',
        patch: {},
        newAreas: [],
      });
    });

    it('fills only empty fields and never overrides an admin edit', () => {
      const [item] = planCandidates(
        [cand({ areas: [...cand().areas, { exclusiveArea: 114.9, rows: 1, typeName: '114' }] })],
        [
          existing({
            id: 'edited',
            name: '부영 3차 (관리자 수정)',
            externalCode: '12150-1001',
            emdCode: '12150114',
            roadAddress: '순천시 관리자가고친길 1',
            builtYear: 1999,
            areaTypes: [
              { exclusiveArea: 84.97, typeName: '84', source: ComplexDataSource.TRADE_BOOTSTRAP },
            ],
          }),
        ],
      );
      expect(item?.action).toBe('UPDATE');
      expect(item?.patch).toEqual({
        emdName: '연향동',
        jibun: '1234-5',
        jibunAddress: '순천시 연향동 1234-5',
      });
      expect(item?.newAreas.map((a) => [a.exclusiveArea, a.typeName])).toEqual([
        [59.84, '59'],
        [114.9, '114'],
      ]);
    });

    it('leaves an admin-made 평형 list alone', () => {
      const [item] = planCandidates(
        [cand()],
        [
          existing({
            id: 'admin',
            name: '연향부영3차',
            emdCode: '12150114',
            areaTypes: [{ exclusiveArea: 84.97, typeName: '84A', source: ComplexDataSource.ADMIN }],
          }),
        ],
      );
      expect(item?.action).toBe('UPDATE');
      expect(item?.newAreas).toEqual([]);
      expect(item?.patch.externalCode).toBe('12150-1001');
    });

    it('does not take a 단지 whose code or 지번 contradicts, nor recreate a deleted one', () => {
      const plan = planCandidates(
        [cand()],
        [
          existing({
            id: 'other',
            name: '연향부영3차',
            emdCode: '12150114',
            externalCode: '12150-77',
          }),
        ],
      );
      expect(plan[0]).toMatchObject({ action: 'CREATE', complexId: null });

      const deleted = planCandidates(
        [cand()],
        [existing({ id: 'gone', name: '연향 부영3차', emdCode: '12150114', deleted: true })],
      );
      expect(deleted[0]).toMatchObject({ action: 'SKIP', reason: '관리자가 삭제한 단지예요' });

      // Deleted under its legacy code and renamed by the admin first: still not recreated.
      const deletedByCode = planCandidates(
        [cand()],
        [
          existing({
            id: 'gone',
            name: '옛 이름',
            emdCode: '12150101',
            externalCode: '46150-1001',
            deleted: true,
          }),
        ],
      );
      expect(deletedByCode[0]).toMatchObject({
        action: 'SKIP',
        reason: '관리자가 삭제한 단지예요',
      });
    });

    it('skips when one admin 단지 is claimed by two candidates or one candidate fits two', () => {
      const twoClaims = planCandidates(
        [cand(), cand({ key: 's:12150-1002', externalCode: '12150-1002', jibun: null })],
        [existing({ id: 'one', name: '연향부영3차', emdCode: '12150114' })],
      );
      expect(twoClaims.map((p) => p.action)).toEqual(['SKIP', 'SKIP']);

      const twoFits = planCandidates(
        [cand({ jibun: null })],
        [
          existing({ id: 'a', name: '연향부영3차', emdCode: '12150114' }),
          existing({ id: 'b', name: '연향 부영3차', emdCode: '12150114' }),
        ],
      );
      expect(twoFits[0]).toMatchObject({ action: 'SKIP', complexId: null });
    });
  });

  describe('geocoder hits', () => {
    const c = { emdCode: '12150114' };
    const hit = (
      legalCode: string | null,
      address = '전남광주통합특별시 순천시 연향동 1234-5',
    ) => ({
      lat: 34.94,
      lng: 127.52,
      roadAddress: address,
      jibunAddress: address,
      legalCode,
    });

    it('accepts only hits inside the 시군구 and the candidate 읍면동', () => {
      expect(pickHit([hit('2611010100')], c, regions)).toBeNull(); // 부산
      expect(pickHit([hit('1215013300')], c, regions)).toBeNull(); // 조례동, not 연향동
      expect(pickHit([hit('4615011400')], c, regions)?.legalCode).toBe('4615011400'); // legacy
      expect(pickHit([hit(null)], c, regions)).not.toBeNull();
      expect(pickHit([hit(null, '광주광역시 북구 연향동 1')], c, regions)).toBeNull();
    });
  });
});
