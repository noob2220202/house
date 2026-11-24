import { describe, expect, it } from 'vitest';
import {
  applyGroupOrder,
  mergeVisibleOrder,
  moveItem,
  placeAt,
  sameOrder,
  stepTarget,
} from './reorder';

describe('moveItem', () => {
  it('moves an item and clamps the target', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 1, -5)).toEqual(['b', 'a', 'c']);
  });

  it('returns a copy and ignores an out-of-range source', () => {
    const list = ['a', 'b'];
    const next = moveItem(list, 5, 0);
    expect(next).toEqual(list);
    expect(next).not.toBe(list);
  });
});

describe('mergeVisibleOrder', () => {
  it('re-places only the visible ids and keeps hidden ones where they are', () => {
    // b, c, d are on screen (page / status filter); a and e are not
    expect(mergeVisibleOrder(['a', 'b', 'c', 'd', 'e'], ['d', 'b', 'c'])).toEqual([
      'a',
      'd',
      'b',
      'c',
      'e',
    ]);
  });

  it('handles visible rows that are not adjacent in the full order', () => {
    expect(mergeVisibleOrder(['a', 'b', 'c', 'd'], ['d', 'a'])).toEqual(['d', 'b', 'c', 'a']);
  });

  it('appends ids the server does not know yet and tolerates removed ones', () => {
    expect(mergeVisibleOrder(['a', 'b'], ['b', 'x', 'a'])).toEqual(['b', 'a', 'x']);
    expect(mergeVisibleOrder(['a', 'c'], ['c', 'a'])).toEqual(['c', 'a']);
  });
});

describe('placeAt', () => {
  it('puts an id at a 1-based position', () => {
    expect(placeAt(['a', 'b', 'c'], 'c', 1)).toEqual(['c', 'a', 'b']);
    expect(placeAt(['a', 'b', 'c'], 'a', 3)).toEqual(['b', 'c', 'a']);
    expect(placeAt(['a', 'b'], 'new', 2)).toEqual(['a', 'new', 'b']);
  });

  it('clamps the position', () => {
    expect(placeAt(['a', 'b'], 'new', 99)).toEqual(['a', 'b', 'new']);
    expect(placeAt(['a', 'b'], 'new', 0)).toEqual(['new', 'a', 'b']);
  });
});

describe('sameOrder', () => {
  it('compares element-wise', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('stepTarget', () => {
  const rows = [
    { id: 'h1', slot: 'HERO' },
    { id: 'h2', slot: 'HERO' },
    { id: 's1', slot: 'STRIP' },
  ];
  const groupOf = (r: { slot: string }) => r.slot;

  it('steps inside the group', () => {
    expect(stepTarget(rows, 0, 1, groupOf)).toBe(1);
    expect(stepTarget(rows, 1, -1, groupOf)).toBe(0);
  });

  it('never crosses into another group or past the list', () => {
    expect(stepTarget(rows, 1, 1, groupOf)).toBe(-1);
    expect(stepTarget(rows, 2, -1, groupOf)).toBe(-1);
    expect(stepTarget(rows, 0, -1, groupOf)).toBe(-1);
    expect(stepTarget(rows, 2, 1, groupOf)).toBe(-1);
  });
});

describe('applyGroupOrder', () => {
  const items = [
    { id: 'h1', sortOrder: 1 },
    { id: 'h2', sortOrder: 2 },
    { id: 'h3', sortOrder: 3 },
    { id: 's1', sortOrder: 1 },
  ];

  it('reorders the group in place and hands its sortOrder numbers out in the new order', () => {
    expect(applyGroupOrder(items, ['h3', 'h1', 'h2'])).toEqual([
      { id: 'h3', sortOrder: 1 },
      { id: 'h1', sortOrder: 2 },
      { id: 'h2', sortOrder: 3 },
      { id: 's1', sortOrder: 1 },
    ]);
  });

  it('keeps the numbers of a page that does not start at 1', () => {
    const page2 = [
      { id: 'h4', sortOrder: 4 },
      { id: 'h5', sortOrder: 5 },
    ];
    expect(applyGroupOrder(page2, ['h5', 'h4'])).toEqual([
      { id: 'h5', sortOrder: 4 },
      { id: 'h4', sortOrder: 5 },
    ]);
  });

  it('ignores unknown ids', () => {
    expect(applyGroupOrder(items, ['zz', 'h2', 'h1'])).toEqual([
      { id: 'h2', sortOrder: 1 },
      { id: 'h1', sortOrder: 2 },
      { id: 'h3', sortOrder: 3 },
      { id: 's1', sortOrder: 1 },
    ]);
  });
});
