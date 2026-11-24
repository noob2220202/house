import {
  matchRegions,
  normalizeSearchQuery,
  parseSearchTab,
  regionMapHref,
  searchHref,
  suggestionHref,
} from './targets';

describe('search targets', () => {
  it('normalises the query param', () => {
    expect(normalizeSearchQuery('  신대   레이크파크 ')).toBe('신대 레이크파크');
    expect(normalizeSearchQuery(['오천', '연향'])).toBe('오천');
    expect(normalizeSearchQuery(undefined)).toBe('');
    expect(normalizeSearchQuery('가'.repeat(80))).toHaveLength(50);
  });

  it('parses the tab and builds result links', () => {
    expect(parseSearchTab('complex')).toBe('complex');
    expect(parseSearchTab('nope')).toBe('all');
    expect(parseSearchTab(undefined)).toBe('all');
    expect(searchHref('신대')).toBe(`/search?q=${encodeURIComponent('신대')}`);
    expect(searchHref('신대', 'agency')).toBe(
      `/search?q=${encodeURIComponent('신대')}&type=agency`,
    );
  });

  it('links a region to the map centred on it', () => {
    const href = regionMapHref({ lat: 34.9215, lng: 127.58 });
    const url = new URL(href, 'http://x');
    expect(url.pathname).toBe('/map/apt');
    expect(url.searchParams.get('c')).toBe('34.9215,127.58');
    expect(url.searchParams.get('z')).toBe('15');
    expect(regionMapHref({ lat: null, lng: null })).toBe('/map/apt');
  });

  it('routes suggestions by type', () => {
    expect(suggestionHref({ type: 'COMPLEX', id: 'c-1' })).toBe('/complex/c-1');
    expect(suggestionHref({ type: 'AGENCY', id: 'b-1' })).toBe('/agency/b-1');
    expect(suggestionHref({ type: 'REGION', id: '4615012100' })).toBe('/map/apt');
  });
});

describe('matchRegions', () => {
  const regions = [
    { code: '1', name: '신대지구', parentName: '해룡면' },
    { code: '2', name: '선월지구', parentName: '해룡면' },
    { code: '3', name: '연향동', parentName: null },
    { code: '4', name: '조례동' },
    { code: '5', name: '왕지동', parentName: null },
  ];
  const codes = (q: string) => matchRegions(regions, q).map((r) => r.code);

  it('matches names ignoring spaces and the 동 / 리 / 지구 suffix', () => {
    expect(codes('연향동')).toEqual(['3']);
    expect(codes('연향')).toEqual(['3']);
    expect(codes('신대리')).toEqual(['1']);
    expect(codes(' 조 례 ')).toEqual(['4']);
  });

  it('matches the parent 읍·면 and ranks exact names first', () => {
    expect(codes('해룡면')).toEqual(['1', '2']);
    expect(codes('해룡면 선월지구')).toEqual(['2']);
    expect(codes('선월지구')[0]).toBe('2');
  });

  it('returns nothing for an empty or unrelated query', () => {
    expect(codes('')).toEqual([]);
    expect(codes('레이크파크')).toEqual([]);
  });
});
