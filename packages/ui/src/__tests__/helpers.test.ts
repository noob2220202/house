import { describe, expect, it } from 'vitest';
import {
  agencyInitials,
  agencyLogoTone,
  formatManwonInput,
  formatManwonReading,
  manwonStepLabel,
  parseManwonInput,
} from '../index';

describe('parseManwonInput', () => {
  it.each([
    ['44500', 44500],
    ['44,500', 44500],
    [' 44,500 ', 44500],
    ['4억 4,500', 44500],
    ['4억4500', 44500],
    ['4억 4,500만원', 44500],
    ['4억 4천500', 44500],
    ['4.5억', 45000],
    ['3억', 30000],
    ['2천', 2000],
    ['9,500만', 9500],
    ['0', 0],
  ])('%s → %d', (input, expected) => {
    expect(parseManwonInput(input)).toBe(expected);
  });
  it.each(['', '   ', '억', '4억 abc', '-500', '4.', '44,500원', '1e5'])(
    'returns null for %j',
    (input) => {
      expect(parseManwonInput(input)).toBeNull();
    },
  );
});

describe('formatManwonInput', () => {
  it('adds thousands separators to digit input', () => {
    expect(formatManwonInput('44500')).toBe('44,500');
    expect(formatManwonInput('4,4500')).toBe('44,500');
    expect(formatManwonInput('0044500')).toBe('44,500');
    expect(formatManwonInput('0')).toBe('0');
    expect(formatManwonInput('')).toBe('');
  });
  it('leaves 억/천 text alone', () => {
    expect(formatManwonInput('4억 4,500')).toBe('4억 4,500');
    expect(formatManwonInput('4.5억')).toBe('4.5억');
  });
});

describe('formatManwonReading', () => {
  it('reads amounts in Korean units', () => {
    expect(formatManwonReading(44500)).toBe('4억 4,500만원');
    expect(formatManwonReading(30000)).toBe('3억원');
    expect(formatManwonReading(9500)).toBe('9,500만원');
    expect(formatManwonReading(1250000)).toBe('125억원');
  });
  it('labels quick-add steps', () => {
    expect(manwonStepLabel(10000)).toBe('+1억');
    expect(manwonStepLabel(5000)).toBe('+5천');
    expect(manwonStepLabel(500)).toBe('+500');
    expect(manwonStepLabel(15000)).toBe('+15,000');
  });
});

describe('agencyInitials', () => {
  it('drops office-type suffixes and company prefixes', () => {
    expect(agencyInitials('호수공원 공인중개사사무소')).toBe('호수');
    expect(agencyInitials('호수공원 공인중개사사무소', 1)).toBe('호');
    expect(agencyInitials('(주)신대부동산')).toBe('신대');
    expect(agencyInitials('연향 부동산 중개법인')).toBe('연향');
    expect(agencyInitials('왕지 중개사무소')).toBe('왕지');
  });
  it('falls back to the full name', () => {
    expect(agencyInitials('부동산')).toBe('부동');
    expect(agencyInitials('  SC Realty ')).toBe('SC');
  });
});

describe('agencyLogoTone', () => {
  const seeds = Array.from({ length: 64 }, (_, i) => `agency-${i}`);

  it('is deterministic per seed', () => {
    for (const seed of seeds) expect(agencyLogoTone(seed)).toBe(agencyLogoTone(seed));
  });
  it('spreads offices over every look, even for ids one character apart', () => {
    const tones = new Set(seeds.map((s) => agencyLogoTone(s)));
    expect([...tones].sort()).toEqual(['accent', 'art', 'brand', 'grey']);
    expect(
      new Set(['A01', 'A02', 'A03', 'A04', 'A05', 'A06'].map((s) => agencyLogoTone(s))).size,
    ).toBeGreaterThan(1);
  });
  it('keeps the auto tint under `initials` and never returns the illustration', () => {
    for (const seed of seeds) {
      const auto = agencyLogoTone(seed);
      const initials = agencyLogoTone(seed, 'initials');
      expect(initials).not.toBe('art');
      if (auto !== 'art') expect(initials).toBe(auto);
      expect(agencyLogoTone(seed, 'art')).toBe('art');
    }
  });
  it('matches the w-agencies avatar tone (same FNV-1a mix) so lists keep their look', () => {
    // Reference values from the original avatarTone() in apps/web w-agencies/lib/agency.ts.
    const ref = (id: string) => {
      let h = 2166136261;
      for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
      h ^= h >>> 15;
      h = Math.imul(h, 2246822519) >>> 0;
      h ^= h >>> 13;
      return (['art', 'brand', 'accent', 'grey'] as const)[(h >>> 0) % 4];
    };
    for (const seed of [...seeds, 'A01', 'cm1x9a', '7b0c2e']) {
      expect(agencyLogoTone(seed)).toBe(ref(seed));
    }
  });
});
