import { builtLabel, complexMeta, pyeongSummary } from './format';

const area = (
  exclusiveArea: number,
  supplyArea: number | null,
  pyeongLabel: string | null = null,
) => ({
  id: `${exclusiveArea}`,
  exclusiveArea,
  supplyArea,
  typeName: '',
  pyeongLabel,
  households: null,
  rooms: null,
  baths: null,
});

describe('search result formatting', () => {
  it('summarises 평형 from labels or areas', () => {
    expect(pyeongSummary([area(84.9, 112.4, '34평'), area(59.9, 82.6), area(101, 135.5)])).toBe(
      '25·34·41평',
    );
    expect(pyeongSummary([])).toBeNull();
    expect(
      pyeongSummary([area(40, 59), area(59, 82), area(84, 112), area(101, 135), area(120, 160)]),
    ).toBe('18~48평');
  });

  it('labels the built year', () => {
    const now = new Date('2026-11-24T00:00:00+09:00');
    expect(builtLabel(2019, now)).toBe('2019년 준공');
    expect(builtLabel(2027, now)).toBe('2027년 입주 예정');
    expect(builtLabel(null, now)).toBeNull();
  });

  it('joins the complex meta line', () => {
    const meta = complexMeta(
      {
        households: 1412,
        builtYear: 2019,
        areaTypes: [area(84.9, 112.4, '34평')],
      } as Parameters<typeof complexMeta>[0],
      new Date('2026-11-24T00:00:00+09:00'),
    );
    expect(meta).toBe('1,412세대 · 2019년 준공 · 34평');
  });
});
