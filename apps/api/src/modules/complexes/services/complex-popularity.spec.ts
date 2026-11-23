import { decayedScores, decayWeight } from './complex-popularity.service';
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
