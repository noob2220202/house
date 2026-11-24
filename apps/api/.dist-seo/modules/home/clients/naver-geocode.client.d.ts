import { AppConfig } from '../../../config/app-config.service';
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
export declare class GeocoderUnavailableError extends Error {
}
/**
 * Address search behind an interface so tests use a fake (no network in tests). The real
 * implementation calls Naver Cloud Maps Geocoding / Reverse Geocoding with the server-side
 * NAVER_MAP_CLIENT_ID / NAVER_MAP_CLIENT_SECRET (never exposed to the browser).
 */
export interface Geocoder {
    /** False when the API keys are not configured (the endpoint answers 503). */
    isConfigured(): boolean;
    geocode(query: string, near: {
        lat: number;
        lng: number;
    } | null): Promise<GeocodeHit[]>;
    /** 10-digit 법정동 code of a point, or null when unknown. */
    legalCode(lat: number, lng: number): Promise<string | null>;
}
export declare const GEOCODER: unique symbol;
/** Naver geocoding payload → hits (invalid coordinates and empty addresses dropped). */
export declare function parseGeocodeResponse(body: unknown): GeocodeHit[];
/** Reverse-geocoding payload → the 법정동 (legalcode) id, or null. */
export declare function parseLegalCode(body: unknown): string | null;
export declare class NaverGeocoder implements Geocoder {
    private readonly config;
    private readonly logger;
    constructor(config: AppConfig);
    isConfigured(): boolean;
    geocode(query: string, near: {
        lat: number;
        lng: number;
    } | null): Promise<GeocodeHit[]>;
    legalCode(lat: number, lng: number): Promise<string | null>;
    private get;
}
