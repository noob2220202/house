import { ComplexMatcher, type MatchableComplex } from './complex-matcher';

const c = (over: Partial<MatchableComplex> & { id: string; name: string }): MatchableComplex => ({
  emdName: null,
  jibun: null,
  jibunAddress: null,
  externalCode: null,
  areaTypes: [],
  ...over,
});

describe('ComplexMatcher', () => {
  const complexes = [
    c({ id: 'seq', name: '신대 중흥S-클래스', externalCode: '12150-9', emdName: '신대리' }),
    c({ id: 'jibun', name: '부영3차', jibunAddress: '전남광주통합특별시 순천시 연향동 1234-5' }),
    c({ id: 'twinA', name: '금호타운1차', emdName: '조례동', jibun: '700' }),
    c({ id: 'twinB', name: '금호타운2차', emdName: '조례동', jibun: '700' }),
    c({ id: 'name', name: 'e편한세상 순천', emdName: '용당동' }),
    c({ id: 'dupA', name: '현대', emdName: '왕지동' }),
    c({ id: 'dupB', name: '현대', emdName: '덕월동' }),
  ];
  const m = new ComplexMatcher(complexes);

  it('matches by aptSeq first', () => {
    expect(
      m.match({ aptSeq: '12150-9', aptName: '완전히다른이름', emdName: null, jibun: null })?.id,
    ).toBe('seq');
  });

  it('treats the legacy 46150- aptSeq (before 2026-07-01) as the same 단지 code', () => {
    const legacy = { aptName: '완전히다른이름', emdName: null, jibun: null };
    expect(m.match({ ...legacy, aptSeq: '46150-9' })?.id).toBe('seq');
    const old = new ComplexMatcher([c({ id: 'old', name: '단지', externalCode: '46150-9' })]);
    expect(old.match({ ...legacy, aptSeq: '12150-9' })?.id).toBe('old');
    expect(old.keeps('old', { aptSeq: '12150-9', jibun: null })).toBe(true);
    expect(old.keeps('old', { aptSeq: '12150-8', jibun: null })).toBe(false);
  });

  it('matches by 법정동 + 지번 (parsed from 지번주소)', () => {
    expect(
      m.match({ aptSeq: null, aptName: '연향부영3차', emdName: '연향동', jibun: '01234-0005' })?.id,
    ).toBe('jibun');
  });

  it('disambiguates a shared 지번 by name, refuses when still ambiguous', () => {
    expect(
      m.match({ aptSeq: null, aptName: '금호타운2차', emdName: '조례동', jibun: '700' })?.id,
    ).toBe('twinB');
    expect(m.match({ aptSeq: null, aptName: '금호', emdName: '조례동', jibun: '700' })).toBeNull();
  });

  it('matches by normalized name within the 법정동, and sgg-wide only when unique', () => {
    expect(
      m.match({ aptSeq: null, aptName: 'e편한세상(순천)', emdName: '용당동', jibun: null })?.id,
    ).toBe('name');
    expect(
      m.match({ aptSeq: null, aptName: 'e편한세상순천', emdName: null, jibun: null })?.id,
    ).toBe('name');
    expect(m.match({ aptSeq: null, aptName: '현대', emdName: '왕지동', jibun: null })?.id).toBe(
      'dupA',
    );
    expect(m.match({ aptSeq: null, aptName: '현대아파트', emdName: null, jibun: null })).toBeNull();
    // 법정동 contradicts the only name candidate
    expect(
      m.match({ aptSeq: null, aptName: 'e편한세상순천', emdName: '연향동', jibun: null }),
    ).toBeNull();
  });

  describe('contradicting signals', () => {
    const hyundai = c({
      id: 'A',
      name: '현대아파트',
      emdName: '연향동',
      jibun: '100',
      externalCode: '12150-100',
    });
    const mm = new ComplexMatcher([hyundai]);

    it('refuses a name match when the trade carries a different 국토교통부 code', () => {
      expect(
        mm.match({ aptSeq: '12150-999', aptName: '현대', emdName: '연향동', jibun: null }),
      ).toBeNull();
      expect(
        mm.match({ aptSeq: '12150-999', aptName: '현대', emdName: null, jibun: null }),
      ).toBeNull();
    });

    it('refuses a name match when the 지번 differs', () => {
      expect(
        mm.match({ aptSeq: null, aptName: '현대', emdName: '연향동', jibun: '555' }),
      ).toBeNull();
      expect(mm.match({ aptSeq: null, aptName: '현대', emdName: null, jibun: '555' })).toBeNull();
      // the review probe: different code AND different 지번
      expect(
        mm.match({ aptSeq: '12150-999', aptName: '현대', emdName: '연향동', jibun: '555' }),
      ).toBeNull();
    });

    it('still matches when the signals agree or are missing', () => {
      expect(
        mm.match({ aptSeq: null, aptName: '현대', emdName: '연향동', jibun: '0100' })?.id,
      ).toBe('A');
      expect(mm.match({ aptSeq: null, aptName: '현대', emdName: '연향동', jibun: null })?.id).toBe(
        'A',
      );
      expect(
        mm.match({ aptSeq: '12150-100', aptName: '다른이름', emdName: null, jibun: '555' })?.id,
      ).toBe('A');
    });

    it('a 지번 conflict drops one twin of a shared 지번 so the other matches', () => {
      const twins = new ComplexMatcher([
        c({ id: 'x', name: '부영1차', emdName: '조례동', jibun: '700', externalCode: '12150-1' }),
        c({ id: 'y', name: '부영2차', emdName: '조례동', jibun: '700' }),
      ]);
      expect(
        twins.match({ aptSeq: '12150-2', aptName: '부영', emdName: '조례동', jibun: '700' })?.id,
      ).toBe('y');
    });

    it('keeps() detaches only on contradiction or a deleted 단지', () => {
      expect(mm.keeps('A', { aptSeq: '12150-100', jibun: '555' })).toBe(true);
      expect(mm.keeps('A', { aptSeq: null, jibun: '100' })).toBe(true);
      expect(mm.keeps('A', { aptSeq: null, jibun: null })).toBe(true);
      expect(mm.keeps('A', { aptSeq: '12150-999', jibun: '100' })).toBe(false);
      expect(mm.keeps('A', { aptSeq: null, jibun: '555' })).toBe(false);
      expect(mm.keeps('gone', { aptSeq: null, jibun: null })).toBe(false);
    });
  });

  it('assigns the nearest 평형 within tolerance', () => {
    const complex = c({
      id: 'x',
      name: 'x',
      areaTypes: [
        { id: '59', exclusiveArea: 59.84 },
        { id: '84A', exclusiveArea: 84.97 },
        { id: '84B', exclusiveArea: 84.6 },
      ],
    });
    expect(ComplexMatcher.areaTypeFor(complex, 84.98)).toBe('84A');
    expect(ComplexMatcher.areaTypeFor(complex, 84.7)).toBe('84B');
    expect(ComplexMatcher.areaTypeFor(complex, 101.9)).toBeNull();
  });
});
