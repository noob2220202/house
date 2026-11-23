import { Prisma } from '@prisma/client';
import { bboxEnvelope, gridSizeForZoom, withinBbox } from './geo';

describe('geo sql fragments', () => {
  const bbox = { swLng: 127.4, swLat: 34.9, neLng: 127.6, neLat: 35.0 };

  it('binds bbox values as parameters (no interpolation)', () => {
    const sql = bboxEnvelope(bbox);
    expect(sql.sql).toBe('ST_MakeEnvelope(?, ?, ?, ?, 4326)::geography');
    expect(sql.values).toEqual([127.4, 34.9, 127.6, 35.0]);
  });

  it('composes with a column fragment', () => {
    const sql = withinBbox(Prisma.raw('location'), bbox);
    expect(sql.sql).toBe('location && ST_MakeEnvelope(?, ?, ?, ?, 4326)::geography');
  });

  it('shrinks the grid as zoom increases', () => {
    expect(gridSizeForZoom(14)).toBeLessThan(gridSizeForZoom(13));
  });
});
