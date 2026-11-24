export interface OAuthHttpRequest {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    /** Sent as application/x-www-form-urlencoded (POST). */
    form?: Record<string, string>;
}
export interface OAuthHttpResponse {
    status: number;
    /** Parsed JSON when the response is JSON, otherwise the raw text. */
    body: unknown;
    headers: Record<string, string>;
}
/**
 * The only network boundary of the OAuth flows (token endpoints, profile APIs, Google JWKS).
 * Tests bind a fake to OAUTH_HTTP so provider parsing / id_token verification still runs for real.
 */
export interface OAuthHttpClient {
    request(req: OAuthHttpRequest): Promise<OAuthHttpResponse>;
}
export declare const OAUTH_HTTP: unique symbol;
export declare class FetchOAuthHttpClient implements OAuthHttpClient {
    request(req: OAuthHttpRequest): Promise<OAuthHttpResponse>;
}
