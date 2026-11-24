import { describe, expect, it } from 'vitest';
import {
  hasActiveFilters,
  pageRange,
  parseListParams,
  patchListParams,
  serializeListParams,
  type ParamSpec,
} from './list-params';

const SPEC = {
  status: { kind: 'enum', values: ['PENDING', 'APPROVED', 'ALL'], fallback: 'PENDING' },
  assetType: { kind: 'enum', values: ['APT', 'LAND'] },
  mine: { kind: 'flag' },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const parse = (query: string) => parseListParams(new URLSearchParams(query), SPEC);

describe('parseListParams', () => {
  it('falls back to the defaults for an empty query', () => {
    expect(parse('')).toEqual({ status: 'PENDING', assetType: '', mine: false, q: '', page: 1 });
  });
  it('reads valid values', () => {
    expect(parse('status=ALL&assetType=LAND&mine=1&q=%EC%8B%A0%EB%8C%80&page=3')).toEqual({
      status: 'ALL',
      assetType: 'LAND',
      mine: true,
      q: '신대',
      page: 3,
    });
  });
  it('ignores values outside the enum and broken page numbers', () => {
    const values = parse('status=HACKED&assetType=%3Cscript%3E&page=-2');
    expect(values.status).toBe('PENDING');
    expect(values.assetType).toBe('');
    expect(values.page).toBe(1);
    expect(parse('page=1.5').page).toBe(1);
    expect(parse('page=abc').page).toBe(1);
  });
  it('trims and caps the search text', () => {
    expect(parse('q=%20%20hello%20').q).toBe('hello');
    expect(parse(`q=${'가'.repeat(80)}`).q).toHaveLength(50);
  });
});

describe('serializeListParams', () => {
  it('drops defaults so the unfiltered list has a clean URL', () => {
    expect(serializeListParams(parse(''), SPEC)).toBe('');
  });
  it('keeps the spec order with page last and round-trips', () => {
    const query = '?status=ALL&assetType=APT&mine=1&q=%EC%98%A4%EC%B2%9C&page=2';
    expect(serializeListParams(parse(query.slice(1)), SPEC)).toBe(query);
  });
  it('omits page 1 and blank text', () => {
    expect(serializeListParams({ ...parse('status=APPROVED'), q: '   ' }, SPEC)).toBe(
      '?status=APPROVED',
    );
  });
});

describe('patchListParams', () => {
  it('returns to page 1 when a filter changes', () => {
    expect(patchListParams(parse('page=4'), { q: '연향' }).page).toBe(1);
    expect(patchListParams(parse('page=4'), { status: 'ALL' }).page).toBe(1);
  });
  it('keeps the page when only the page changes or nothing really changed', () => {
    expect(patchListParams(parse('page=4'), { page: 5 }).page).toBe(5);
    expect(patchListParams(parse('status=ALL&page=4'), { status: 'ALL' }).page).toBe(4);
  });
  it('honours an explicit page next to a filter change', () => {
    expect(patchListParams(parse('page=4'), { status: 'ALL', page: 2 }).page).toBe(2);
  });
});

describe('hasActiveFilters', () => {
  it('is false for defaults and true for any changed filter', () => {
    expect(hasActiveFilters(parse(''), SPEC)).toBe(false);
    expect(hasActiveFilters(parse('page=3'), SPEC)).toBe(false);
    expect(hasActiveFilters(parse('q=a'), SPEC)).toBe(true);
    expect(hasActiveFilters(parse('mine=1'), SPEC)).toBe(true);
  });
  it('can ignore the tab key', () => {
    expect(hasActiveFilters(parse('status=ALL'), SPEC)).toBe(true);
    expect(hasActiveFilters(parse('status=ALL'), SPEC, ['status'])).toBe(false);
  });
});

describe('pageRange', () => {
  it('gives the 1-based range of a page', () => {
    expect(pageRange(1, 10, 22)).toEqual([1, 10]);
    expect(pageRange(3, 10, 22)).toEqual([21, 22]);
    expect(pageRange(1, 10, 0)).toEqual([0, 0]);
    expect(pageRange(9, 10, 22)).toEqual([22, 22]);
  });
});
