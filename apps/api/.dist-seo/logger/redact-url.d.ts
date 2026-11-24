/**
 * Strips sensitive query values from a request URL before it is logged.
 *
 * Logs keep the path and the query keys (useful for debugging) but never the values of
 * parameters that carry credentials (OAuth code/state), PII (search text that may be a phone
 * number, contact fields) or location (bbox/lat/lng — the 위치기반서비스 terms promise that
 * location is not stored). Unparseable input is reduced to its path only.
 */
export declare const REDACTED = "[redacted]";
export declare function redactUrl(url: string | undefined | null): string;
