import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AppConfig } from '../../../config/app-config.service';
import { GEOCODE_MAX_RESULTS, KAKAO_LOCAL } from '../constants';

/** One address candidate from the geocoder (coordinates WGS84). */
export interface GeocodeHit {
  roadAddress: string;
  jibunAddress: string | null;
  zipCode: string | null;
  buildingName: string | null;
  lat: number;
  lng: number;
}

/**
 * A hit as the geocoder returns it: plus the 10-digit 법정동 code when the address answer already
 * carries it (Kakao `address.b_code`), so no reverse lookup is needed for it. Not part of the API
 * response (GeocodeService strips it).
 */
export interface GeocoderHit extends GeocodeHit {
  legalCode?: string | null;
}

/** Thrown when the external geocoder fails (timeout, HTTP error, unexpected payload). */
export class GeocoderUnavailableError extends Error {}

/**
 * Address search behind an interface so tests use a fake (no network in tests). The real
 * implementation calls the Kakao Local API (주소 검색 / 좌표→행정구역) with the server-side REST API
 * key — `KAKAO_REST_API_KEY`, defaulting to `KAKAO_CLIENT_ID` (the same 카카오 앱's REST API 키 the
 * login uses). The key is never exposed to the browser.
 */
export interface Geocoder {
  /** False when no REST API key is configured (the endpoint answers 503). */
  isConfigured(): boolean;
  geocode(query: string): Promise<GeocoderHit[]>;
  /** 10-digit 법정동 code of a point, or null when unknown. */
  legalCode(lat: number, lng: number): Promise<string | null>;
}

export const GEOCODER = Symbol('GEOCODER');

const text = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null);

/** GET /v2/local/search/address.json (fields we read; Kakao sends coordinates as strings). */
const addressSearchSchema = z.object({
  documents: z.array(
    z.object({
      address_name: text,
      x: z.string(),
      y: z.string(),
      address: z.object({ address_name: text, b_code: text }).nullish(),
      road_address: z.object({ address_name: text, zone_no: text, building_name: text }).nullish(),
    }),
  ),
});

/** GET /v2/local/geo/coord2regioncode.json — one 법정동 ('B') and one 행정동 ('H') document. */
const regionCodeSchema = z.object({
  documents: z.array(z.object({ region_type: z.string(), code: z.string() })),
});

const LEGAL_CODE = /^\d{10}$/;

/** Kakao address-search payload → hits (invalid coordinates and empty addresses dropped). */
export function parseAddressSearch(body: unknown): GeocoderHit[] {
  const parsed = addressSearchSchema.safeParse(body);
  if (!parsed.success) throw new GeocoderUnavailableError('invalid payload');
  return parsed.data.documents.flatMap((d): GeocoderHit[] => {
    const lat = Number(d.y);
    const lng = Number(d.x);
    const jibun = d.address?.address_name ?? null;
    const road = d.road_address?.address_name ?? jibun ?? d.address_name;
    if (!road || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0))
      return [];
    const bCode = d.address?.b_code ?? null;
    return [
      {
        roadAddress: road,
        jibunAddress: jibun,
        zipCode: d.road_address?.zone_no ?? null,
        buildingName: d.road_address?.building_name ?? null,
        lat,
        lng,
        legalCode: bCode && LEGAL_CODE.test(bCode) ? bCode : null,
      },
    ];
  });
}

/** coord2regioncode payload → the 법정동 (region_type 'B') code, or null. */
export function parseRegionCode(body: unknown): string | null {
  const parsed = regionCodeSchema.safeParse(body);
  if (!parsed.success) return null;
  const code = parsed.data.documents.find((d) => d.region_type === 'B')?.code ?? null;
  return code && LEGAL_CODE.test(code) ? code : null;
}

@Injectable()
export class KakaoGeocoder implements Geocoder {
  private readonly logger = new Logger(KakaoGeocoder.name);

  constructor(private readonly config: AppConfig) {}

  /** REST API 키: the dedicated KAKAO_REST_API_KEY, else the login's KAKAO_CLIENT_ID. */
  private get restKey(): string | undefined {
    return this.config.get('KAKAO_REST_API_KEY') ?? this.config.get('KAKAO_CLIENT_ID');
  }

  isConfigured(): boolean {
    return !!this.restKey;
  }

  async geocode(query: string): Promise<GeocoderHit[]> {
    const url = new URL(KAKAO_LOCAL.ADDRESS_SEARCH);
    url.searchParams.set('query', query);
    url.searchParams.set('size', String(GEOCODE_MAX_RESULTS));
    return parseAddressSearch(await this.get(url));
  }

  async legalCode(lat: number, lng: number): Promise<string | null> {
    const url = new URL(KAKAO_LOCAL.COORD_TO_REGION);
    url.searchParams.set('x', String(lng));
    url.searchParams.set('y', String(lat));
    try {
      return parseRegionCode(await this.get(url));
    } catch (err) {
      this.logger.warn({ err }, 'reverse geocoding failed');
      return null;
    }
  }

  private async get(url: URL): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { authorization: `KakaoAK ${this.restKey ?? ''}`, accept: 'application/json' },
        signal: AbortSignal.timeout(KAKAO_LOCAL.TIMEOUT_MS),
      });
    } catch (err) {
      throw new GeocoderUnavailableError(`request failed: ${String(err)}`);
    }
    if (!res.ok) {
      // 401/403: wrong key or 카카오맵 not enabled for the app — the body says which.
      const detail = await res.text().catch(() => '');
      throw new GeocoderUnavailableError(`HTTP ${res.status} ${detail.slice(0, 200)}`.trim());
    }
    try {
      return await res.json();
    } catch {
      throw new GeocoderUnavailableError('invalid JSON');
    }
  }
}
