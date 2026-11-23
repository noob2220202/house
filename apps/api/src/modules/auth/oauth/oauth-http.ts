import { Injectable } from '@nestjs/common';

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

export const OAUTH_HTTP = Symbol('OAUTH_HTTP');

const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_000_000;

@Injectable()
export class FetchOAuthHttpClient implements OAuthHttpClient {
  async request(req: OAuthHttpRequest): Promise<OAuthHttpResponse> {
    const headers: Record<string, string> = { Accept: 'application/json', ...req.headers };
    let body: string | undefined;
    if (req.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
      body = new URLSearchParams(req.form).toString();
    }
    const res = await fetch(req.url, {
      method: req.method,
      headers,
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (text.length > MAX_BODY_BYTES) throw new Error(`OAuth response too large from ${req.url}`);
    let parsed: unknown = text;
    if ((res.headers.get('content-type') ?? '').includes('json') || /^\s*[{[]/.test(text)) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }
    const outHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      outHeaders[key.toLowerCase()] = value;
    });
    return { status: res.status, body: parsed, headers: outHeaders };
  }
}
