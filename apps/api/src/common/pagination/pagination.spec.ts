import { decodeCursor, encodeCursor, toCursorPage, toPaginated, toSkipTake } from './pagination';

describe('pagination', () => {
  it('computes skip/take', () => {
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });
  it('builds a page', () => {
    expect(toPaginated([1, 2], 41, { page: 1, pageSize: 20 }).totalPages).toBe(3);
    expect(toPaginated([], 0, { page: 1, pageSize: 20 }).totalPages).toBe(1);
  });
  it('builds cursor pages', () => {
    const page = toCursorPage([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, (r) => r.id);
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor ?? undefined)).toBe('b');
    expect(decodeCursor(encodeCursor('x|1'))).toBe('x|1');
  });
});
