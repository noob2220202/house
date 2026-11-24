import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AppConfig } from '../../../config/app-config.service';
import { GEOCODE_MAX_RESULTS, NAVER_MAPS } from '../constants';

/** One address candidate from the geocoder (coordinates WGS84). */
export interface GeocodeHit {
  roadAddress: string;
  jibunAddress: string | null;
  zipCode: string | null;
  buildingName: string | null;
  lat: number;
  lng: number;
}

/** Thrown when the external geocoder fails (timeout, HTTP error, unexpected payload). */
export class GeocoderUnavailableError extends Error {}

/**
 * Address search behind an interface so tests use a fake (no network in tests). The real
 * implementation calls Naver Cloud Maps Geocoding / Reverse Geocoding with the server-side
 * NAVER_MAP_CLIENT_ID / NAVER_MAP_CLIENT_SECRET (never exposed to the browser).
 */
export interface Geocoder {
  /** False when the API keys are not configured (the endpoint answers 503). */
  isConfigured(): boolean;
  geocode(query: string, near: { lat: number; lng: number } | null): Promise<GeocodeHit[]>;
  /** 10-digit 법정동 code of a point, or null when unknown. */
  legalCode(lat: number, lng: number): Promise<string | null>;
}

export const GEOCODER = Symbol('GEOCODER');

const geocodeResponseSchema = z.object({
  status: z.string(),
  errorMessage: z.string().nullish(),
  addresses: z
    .array(
      z.object({
        roadAddress: z.string().nullish(),
        jibunAddress: z.string().nullish(),
        x: z.string(),
        y: z.string(),
        addressElements: z
          .array(
            z.object({
              types: z.array(z.string()).default([]),
              longName: z.string().nullish(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

const reverseResponseSchema = z.object({
  status: z.object({ code: z.number() }),
  results: z
    .array(z.object({ name: z.string(), code: z.object({ id: z.string() }).nullish() }))
    .default([]),
});

/** Naver geocoding payload → hits (invalid coordinates and empty addresses dropped). */
export function parseGeocodeResponse(body: unknown): GeocodeHit[] {
  const parsed = geocodeResponseSchema.safeParse(body);
  if (!parsed.success || parsed.data.status !== 'OK') {
    throw new GeocoderUnavailableError(
      parsed.success ? (parsed.data.errorMessage ?? parsed.data.status) : 'invalid payload',
    );
  }
  return parsed.data.addresses.flatMap((a) => {
    const lat = Number(a.y);
    const lng = Number(a.x);
    const road = a.roadAddress?.trim() || a.jibunAddress?.trim() || '';
    if (!road || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const element = (type: string) =>
      a.addressElements.find((e) => e.types.includes(type))?.longName?.trim() || null;
    return [
      {
        roadAddress: road,
        jibunAddress: a.jibunAddress?.trim() || null,
        zipCode: element('POSTAL_CODE'),
        buildingName: element('BUILDING_NAME'),
        lat,
        lng,
      },
    ];
  });
}

/** Reverse-geocoding payload → the 법정동 (legalcode) id, or null. */
export function parseLegalCode(body: unknown): string | null {
  const parsed = reverseResponseSchema.safeParse(body);
  if (!parsed.success || parsed.data.status.code !== 0) return null;
  const id = parsed.data.results.find((r) => r.name === 'legalcode')?.code?.id ?? null;
  return id && /^\d{10}$/.test(id) ? id : null;
}

@Injectable()
export class NaverGeocoder implements Geocoder {
  private readonly logger = new Logger(NaverGeocoder.name);

  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return !!this.config.get('NAVER_MAP_CLIENT_ID') && !!this.config.get('NAVER_MAP_CLIENT_SECRET');
  }

  async geocode(query: string, near: { lat: number; lng: number } | null): Promise<GeocodeHit[]> {
    const url = new URL(NAVER_MAPS.GEOCODE);
    url.searchParams.set('query', query);
    url.searchParams.set('count', String(GEOCODE_MAX_RESULTS));
    if (near) url.searchParams.set('coordinate', `${near.lng},${near.lat}`);
    return parseGeocodeResponse(await this.get(url));
  }

  async legalCode(lat: number, lng: number): Promise<string | null> {
    const url = new URL(NAVER_MAPS.REVERSE_GEOCODE);
    url.searchParams.set('coords', `${lng},${lat}`);
    url.searchParams.set('orders', 'legalcode');
    url.searchParams.set('output', 'json');
    try {
      return parseLegalCode(await this.get(url));
    } catch (err) {
      this.logger.warn({ err }, 'reverse geocoding failed');
      return null;
    }
  }

  private async get(url: URL): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'x-ncp-apigw-api-key-id': this.config.get('NAVER_MAP_CLIENT_ID') ?? '',
          'x-ncp-apigw-api-key': this.config.get('NAVER_MAP_CLIENT_SECRET') ?? '',
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(NAVER_MAPS.TIMEOUT_MS),
      });
    } catch (err) {
      throw new GeocoderUnavailableError(`request failed: ${String(err)}`);
    }
    if (!res.ok) throw new GeocoderUnavailableError(`HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new GeocoderUnavailableError('invalid JSON');
    }
  }
}
