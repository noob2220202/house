import { decayedScores, decayWeight, networkPrefix } from './complex-popularity.service';
import { escapeLike } from './complex-search.service';

describe('popularity scoring', () => {
  it('halves the weight every half-life (7 days)', () => {
    expect(decayWeight(0)).toBe(1);
    expect(decayWeight(7)).toBeCloseTo(0.5);
    expect(decayWeight(14)).toBeCloseTo(0.25);
  });

  it('sums decayed daily views per complex and ignores junk', () => {
    const scores = decayedScores([
      ['a', '4', 'b', '1'],
      [],
      ['a', 'x', 'c', '-2'],
      ...Array.from({ length: 4 }, () => []),
      ['b', '8'],
    ]);
    expect(scores.get('a')).toBe(4);
    expect(scores.get('b')).toBeCloseTo(1 + 8 * 0.5);
    expect(scores.has('c')).toBe(false);
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('networkPrefix', () => {
  it('groups IPv4 by /24 (also IPv4-mapped IPv6) and IPv6 by /64', () => {
    expect(networkPrefix('203.0.113.7')).toBe('203.0.113.0/24');
    expect(networkPrefix('::ffff:203.0.113.200')).toBe('203.0.113.0/24');
    expect(networkPrefix('2001:db8:0a:1:ffff::1')).toBe('2001:db8:a:1::/64');
    expect(networkPrefix('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkPrefix('2001:0db8:0000:0001:0000:0000:0000:0001')).toBe('2001:db8:0:1::/64');
    expect(networkPrefix('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(networkPrefix('::1')).toBe('0:0:0:0::/64');
    expect(networkPrefix(undefined)).toBeNull();
    expect(networkPrefix('not-an-ip')).toBeNull();
  });
});
