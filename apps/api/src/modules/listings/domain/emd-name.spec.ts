import { emdNameCandidates, emdNameOf, type RegionNameRow } from './emd-name';

const rows: RegionNameRow[] = [
  // 읍면동 stored with 8 digits (행안부 list) and with 10 digits (seed sample), and a 리 row.
  { code: '12150119', name: '조례동', level: 'EMD', parent: { name: '순천시' } },
  { code: '1215010400', name: '남내동', level: 'EMD', parent: { name: '순천시' } },
  { code: '12150310', name: '해룡면', level: 'EMD', parent: { name: '순천시' } },
  { code: '1215031022', name: '신대리', level: 'RI', parent: { name: '해룡면' } },
];
const byCode = new Map(rows.map((r) => [r.code, r]));

describe('emdNameOf', () => {
  it('names a 읍면동 whether the code or the row uses 8 or 10 digits', () => {
    expect(emdNameOf('12150119', byCode)).toBe('조례동');
    expect(emdNameOf('1215011900', byCode)).toBe('조례동');
    expect(emdNameOf('1215010400', byCode)).toBe('남내동');
    expect(emdNameOf('12150104', byCode)).toBe('남내동');
  });

  it('names a 리 with its 읍면, and falls back to the 읍면 for an unknown 리', () => {
    expect(emdNameOf('1215031022', byCode)).toBe('해룡면 신대리');
    expect(emdNameOf('1215031099', byCode)).toBe('해룡면');
  });

  it('is null for unknown, missing and 시군구-level codes', () => {
    expect(emdNameOf('12150999', byCode)).toBeNull();
    expect(emdNameOf(null, byCode)).toBeNull();
    expect(emdNameOf('12150', byCode)).toBeNull();
  });

  it('looks a code up under its 8- and 10-digit forms', () => {
    expect(emdNameCandidates('1215031022')).toEqual(['1215031022', '12150310', '1215031000']);
    expect(emdNameCandidates('12150119')).toEqual(['12150119', '1215011900']);
  });
});
