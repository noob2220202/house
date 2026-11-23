import {
  appearsIn,
  candidateContexts,
  placementGrows,
  windowGrows,
  worstContextConcurrency,
  type PlacedWindow,
} from './slot-capacity';
import { anonymousIdentity, isTopLevelNavigation } from './visitor';

const t = (iso: string): Date => new Date(`2026-12-01T${iso}:00Z`);
const W = { startAt: t('10:00'), endAt: t('12:00') };
const C1 = '01937a2b-0000-7000-8000-0000000000c1';
const C2 = '01937a2b-0000-7000-8000-0000000000c2';
const codes = new Map<string, string[]>([
  [C1, ['46150', '46150101']],
  [C2, ['46150', '46150250']],
]);

const all = (): PlacedWindow => ({ ...W, targeting: 'ALL', regionCodes: [], complexIds: [] });
const regions = (...r: string[]): PlacedWindow => ({
  ...W,
  targeting: 'REGIONS',
  regionCodes: r,
  complexIds: [],
});
const complexes = (...c: string[]): PlacedWindow => ({
  ...W,
  targeting: 'COMPLEXES',
  regionCodes: [],
  complexIds: c,
});

describe('slot capacity per page context', () => {
  it('appearsIn mirrors serving (prefix match for regions, complexes by id + their regions)', () => {
    const c1 = { kind: 'complex' as const, complexId: C1, regionCodes: codes.get(C1)! };
    expect(appearsIn(all(), { kind: 'global' })).toBe(true);
    expect(appearsIn(regions('46150'), { kind: 'global' })).toBe(false);
    expect(appearsIn(regions('46150'), { kind: 'region', regionCode: '4615010100' })).toBe(true);
    expect(appearsIn(regions('46150101'), { kind: 'region', regionCode: '46150' })).toBe(false);
    expect(appearsIn(regions('46150101'), c1)).toBe(true);
    expect(appearsIn(regions('46150250'), c1)).toBe(false);
    expect(appearsIn(complexes(C1), c1)).toBe(true);
    expect(appearsIn(complexes(C2), c1)).toBe(false);
  });

  it('complex-targeted banners on different complexes do not compete', () => {
    const others = [complexes(C1), complexes(C1), complexes(C2)];
    expect(worstContextConcurrency(W, complexes(C2), others, codes)).toMatchObject({
      peak: 1,
      context: { kind: 'complex', complexId: C2 },
    });
    expect(worstContextConcurrency(W, complexes(C1), others, codes).peak).toBe(2);
  });

  it('ALL and region banners compete on complex pages under them', () => {
    const others = [all(), regions('46150101'), complexes(C1), complexes(C2)];
    const r = worstContextConcurrency(W, complexes(C1), others, codes);
    expect(r).toMatchObject({ peak: 3, context: { complexId: C1 } });
    // A city-wide region banner: worst page is C1 (ALL + 46150101 + C1-targeted).
    expect(worstContextConcurrency(W, regions('46150'), others, codes)).toMatchObject({
      peak: 3,
      context: { kind: 'complex', complexId: C1 },
    });
    // An ALL banner: same worst page.
    expect(worstContextConcurrency(W, all(), others, codes).peak).toBe(3);
  });

  it('regions in different 읍면동 do not compete; ancestors do', () => {
    const others = [regions('46150101'), regions('46150101'), regions('46150')];
    expect(worstContextConcurrency(W, regions('46150250'), others, codes).peak).toBe(1);
    expect(worstContextConcurrency(W, regions('4615010100'), others, codes).peak).toBe(3);
    expect(
      candidateContexts(regions('46150'), others, codes).map((c) =>
        c.kind === 'region' ? c.regionCode : c.kind,
      ),
    ).toEqual(['46150', '46150101']);
  });

  it('uses the time sweep inside each context', () => {
    const early = { ...complexes(C1), startAt: t('08:00'), endAt: t('10:30') };
    const late = { ...complexes(C1), startAt: t('11:00'), endAt: t('13:00') };
    expect(worstContextConcurrency(W, complexes(C1), [early, late], codes).peak).toBe(1);
  });
});

describe('placementGrows / windowGrows', () => {
  it('narrowing never grows, widening does', () => {
    expect(placementGrows(all(), complexes(C1))).toBe(false);
    expect(placementGrows(complexes(C1), all())).toBe(true);
    expect(placementGrows(complexes(C1, C2), complexes(C1))).toBe(false);
    expect(placementGrows(complexes(C1), complexes(C1, C2))).toBe(true);
    expect(placementGrows(regions('46150'), regions('46150101'))).toBe(false);
    expect(placementGrows(regions('46150101'), regions('46150'))).toBe(true);
    expect(placementGrows(regions('46150'), complexes(C1))).toBe(true);
    expect(placementGrows(all(), all())).toBe(false);
    expect(placementGrows(regions('46150'), regions('46150'))).toBe(false);
  });

  it('only un-pausing, earlier starts and later ends grow the window', () => {
    const cur = { ...W, paused: false };
    expect(windowGrows(cur, { ...W, endAt: t('11:00'), paused: false })).toBe(false);
    expect(windowGrows(cur, { ...W, startAt: t('11:00'), paused: false })).toBe(false);
    expect(windowGrows(cur, { ...W, endAt: t('13:00'), paused: false })).toBe(true);
    expect(windowGrows(cur, { ...W, startAt: t('09:00'), paused: false })).toBe(true);
    expect(windowGrows({ ...W, paused: true }, { ...W, paused: false })).toBe(true);
    expect(windowGrows(cur, { ...W, endAt: t('13:00'), paused: true })).toBe(false);
  });
});

describe('anonymousIdentity', () => {
  it('uses the IPv4 address (also when IPv4-mapped)', () => {
    expect(anonymousIdentity('10.0.0.1')).toBe('a4:10.0.0.1');
    expect(anonymousIdentity('::ffff:10.0.0.1')).toBe('a4:10.0.0.1');
  });

  it('groups IPv6 addresses by /64', () => {
    const a = anonymousIdentity('2001:db8:1:2:aaaa::1');
    expect(a).toBe('a6:2001:db8:1:2::/64');
    expect(anonymousIdentity('2001:0DB8:0001:0002:ffff:ffff:ffff:ffff')).toBe(a);
    expect(anonymousIdentity('[2001:db8:1:2::9]')).toBe(a);
    expect(anonymousIdentity('2001:db8:1:3::1')).not.toBe(a);
    expect(anonymousIdentity('::1')).toBe('a6:0:0:0:0::/64');
    expect(anonymousIdentity('64:ff9b::192.0.2.1')).toBe('a6:64:ff9b:0:0::/64');
  });

  it('rejects missing / invalid addresses', () => {
    expect(anonymousIdentity(null)).toBeNull();
    expect(anonymousIdentity('')).toBeNull();
    expect(anonymousIdentity('not-an-ip')).toBeNull();
    expect(anonymousIdentity('10.0.0.256')).toBeNull();
  });
});

describe('isTopLevelNavigation', () => {
  it('accepts navigations and requests without Fetch Metadata', () => {
    expect(isTopLevelNavigation('document', 'navigate')).toBe(true);
    expect(isTopLevelNavigation(null, null)).toBe(true);
  });

  it('rejects embedded subresource / script requests', () => {
    expect(isTopLevelNavigation('image', 'no-cors')).toBe(false);
    expect(isTopLevelNavigation('image', null)).toBe(false);
    expect(isTopLevelNavigation('empty', 'cors')).toBe(false);
    expect(isTopLevelNavigation('iframe', 'navigate')).toBe(false);
    expect(isTopLevelNavigation(null, 'no-cors')).toBe(false);
  });
});
