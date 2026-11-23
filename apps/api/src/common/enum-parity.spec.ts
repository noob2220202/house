import * as shared from '@house/shared';
import { $Enums } from '@prisma/client';

/** Every Prisma enum must have an identical `as const` twin in @house/shared (and vice versa). */
describe('shared enums ↔ Prisma enums', () => {
  const prismaEnums = $Enums as unknown as Record<string, Record<string, string>>;
  const sharedExports = shared as unknown as Record<string, unknown>;

  it.each(Object.keys(prismaEnums))('%s matches', (name) => {
    const twin = sharedExports[name];
    expect(twin).toBeDefined();
    expect(Object.values(twin as Record<string, string>).sort()).toEqual(
      Object.values(prismaEnums[name]!).sort(),
    );
  });
});
