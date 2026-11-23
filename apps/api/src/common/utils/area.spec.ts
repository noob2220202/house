import { Prisma } from '@prisma/client';
import { decimalSqmToPyeong, pyeongLabel, pyeongToSqm, sqmToPyeong } from './area';

describe('area utils', () => {
  it('converts 평 ↔ ㎡ (1평 = 3.305785㎡)', () => {
    expect(sqmToPyeong(3.305785)).toBe(1);
    expect(pyeongToSqm(10)).toBe(33.06);
    expect(decimalSqmToPyeong(new Prisma.Decimal('84.97'))).toBe(25.7);
    expect(decimalSqmToPyeong(null)).toBeNull();
    expect(pyeongLabel(84.97)).toBe('26평');
  });
});
