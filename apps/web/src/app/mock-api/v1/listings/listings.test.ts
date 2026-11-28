import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// The mock routes 404 unless mock mode is on; the flag is read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import { listingPageSchema } from '@/lib/api/schemas/listing';
import { GET as getListings } from './route';

const req = (path: string) => new NextRequest(`http://localhost/mock-api/v1${path}&_delay=1`);
const page = async (path: string) =>
  listingPageSchema.parse(await (await getListings(req(path))).json());

const CITY = 'bbox=127.3,34.8,127.7,35.1&assetTypes=APT&pageSize=100';

describe('GET /listings?withoutComplex', () => {
  it('keeps only the listings without a 단지 (the map price pills), total included', async () => {
    const all = await page(`/listings?${CITY}`);
    const solo = await page(`/listings?${CITY}&withoutComplex=true`);
    expect(all.items.some((l) => l.complexId)).toBe(true);
    expect(solo.total).toBeGreaterThan(0);
    expect(solo.total).toBeLessThan(all.total);
    expect(solo.items.every((l) => !l.complexId)).toBe(true);
    expect((await page(`/listings?${CITY}&withoutComplex=false`)).total).toBe(all.total);
  });

  it('applies to the home sample too', async () => {
    const solo = await page('/listings?pageSize=100&withoutComplex=true');
    expect(solo.items.every((l) => !l.complexId)).toBe(true);
  });
});
