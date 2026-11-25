import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SUNCHEON_REGIONS, suncheonRegionFullName } from './suncheon-regions.data';

/**
 * The data migration that replaced the sample regions on existing databases carries its own copy
 * of the verified list; it must stay identical to the bundled list the base seed loads.
 */
describe('regions_verified_list migration', () => {
  const sql = readFileSync(
    path.join(
      __dirname,
      '../../../../prisma/schema/migrations/20261125140000_regions_verified_list/migration.sql',
    ),
    'utf8',
  );
  const rows = [
    ...sql.matchAll(
      /^ {2}\('(\d+)', '([^']+)', '(EMD|RI)', '(\d+)', '([^']+)', ([\d.]+), ([\d.]+), (\d+)\)[,;]?$/gm,
    ),
  ].map((m) => ({
    code: m[1],
    name: m[2],
    level: m[3],
    parentCode: m[4],
    fullName: m[5],
    lat: Number(m[6]),
    lng: Number(m[7]),
    sortOrder: Number(m[8]),
  }));

  it('loads exactly the bundled verified list, in order', () => {
    expect(rows).toEqual(
      SUNCHEON_REGIONS.map((r, i) => ({
        code: r.code,
        name: r.name,
        level: r.level,
        parentCode: r.parentCode,
        fullName: suncheonRegionFullName(r),
        lat: r.lat,
        lng: r.lng,
        sortOrder: i,
      })),
    );
  });

  it('never rewrites 중개사무소 등록번호 or trade records', () => {
    expect(sql).not.toMatch(/registration_number|registration_key|"trade_records"\s+SET/i);
  });
});
