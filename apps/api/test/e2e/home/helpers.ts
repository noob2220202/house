import { AdminRole } from '@house/shared';
import {
  GEOCODER,
  GeocoderUnavailableError,
  type GeocodeHit,
  type Geocoder,
} from '../../../src/modules/home/clients/naver-geocode.client';
import { RegionsService } from '../../../src/modules/complexes/services/regions.service';
import {
  createAdmin,
  createTestApp,
  loginAdmin,
  type TestApp,
  type TestSession,
} from '../../utils';

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
/** 연향동 (8-digit 행안부 code, as seeded) and its 10-digit Kakao spelling. */
export const YEONHYANG = '12150114';
export const YEONHYANG_10 = '1215011400';
/** 조례동 */
export const JORYE = '12150133';

/** Fixture geocoder: hits per query, legal codes per "lat,lng", injectable failure. */
export class FakeGeocoder implements Geocoder {
  configured = true;
  failWith: Error | null = null;
  readonly queries: string[] = [];
  readonly hits = new Map<string, GeocodeHit[]>();
  readonly codes = new Map<string, string>();

  isConfigured(): boolean {
    return this.configured;
  }

  async geocode(query: string): Promise<GeocodeHit[]> {
    this.queries.push(query);
    if (this.failWith) throw this.failWith;
    return this.hits.get(query) ?? [];
  }

  async legalCode(lat: number, lng: number): Promise<string | null> {
    return this.codes.get(`${lat},${lng}`) ?? null;
  }

  reset(): void {
    this.configured = true;
    this.failWith = null;
    this.queries.length = 0;
    this.hits.clear();
    this.codes.clear();
  }
}

export { GeocoderUnavailableError };

export function createHomeApp(geocoder: FakeGeocoder = new FakeGeocoder()): Promise<TestApp> {
  return createTestApp({ override: (b) => b.overrideProvider(GEOCODER).useValue(geocoder) });
}

export async function seedRegions(t: TestApp): Promise<void> {
  await t.app.get(RegionsService).seedDefault();
}

export async function adminSession(
  t: TestApp,
  role: AdminRole = AdminRole.ADMIN,
): Promise<TestSession> {
  const admin = await createAdmin(t.prisma, { role });
  return loginAdmin(t.app, { id: admin.id, role });
}
