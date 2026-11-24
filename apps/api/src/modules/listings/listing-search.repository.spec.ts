import { ListingSort } from '@house/shared';
import { filterConditions, ListingSearchRepository } from './listing-search.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const repo = new ListingSearchRepository({} as PrismaService);
const join = (parts: Prisma.Sql[]) => Prisma.join(parts, ' AND ');

describe('listing search SQL', () => {
  it('binds every user value as a parameter (no interpolation into SQL text)', () => {
    const evil = "'; DROP TABLE listings; --";
    const sql = join(
      filterConditions(
        {
          emdCode: '12150101',
          complexId: '01890000-0000-7000-8000-000000000001',
          dealTypes: ['SALE'],
          priceMin: 100,
          options: ['ELEVATOR'],
          assetTypes: [evil as never],
        },
        { swLng: 127.4, swLat: 34.9, neLng: 127.5, neLat: 35 },
      ),
    );
    expect(sql.sql).not.toContain('DROP');
    expect(sql.values).toEqual(expect.arrayContaining([[evil], '12150101%', 100, 127.4]));
  });

  it('maps emdCode length to the right column', () => {
    expect(join(filterConditions({ emdCode: '12150' })).sql).toContain('l.sgg_code = ?');
    expect(join(filterConditions({ emdCode: '1215010100' })).sql).toContain('l.emd_code = ?');
    expect(join(filterConditions({ emdCode: '12150101' })).sql).toContain('l.emd_code LIKE ?');
  });

  it('builds one branch per public status and null segment for nullable sorts', () => {
    const nullable = repo.listSql({}, undefined, ListingSort.VERIFIED, 40, 20);
    expect(nullable.sql.match(/UNION ALL/g)).toHaveLength(3);
    expect(nullable.sql).toContain('l.verified_at IS NULL');
    expect(nullable.values).toEqual(expect.arrayContaining([60, 40, 20]));
    const simple = repo.listSql({}, undefined, ListingSort.LATEST, 0, 20);
    expect(simple.sql.match(/UNION ALL/g)).toHaveLength(1);
  });
});
