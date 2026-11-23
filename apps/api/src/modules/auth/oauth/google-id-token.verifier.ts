import { createPublicKey, type JsonWebKey, type KeyObject, verify } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthProvider } from '@house/shared';
import { z } from 'zod';
import { OAUTH_HTTP, type OAuthHttpClient } from './oauth-http';
import { OAuthProviderError } from './oauth-provider';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;

const CLOCK_SKEW_SECONDS = 60;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;
/** Unknown `kid` triggers a refetch (key rotation), but at most this often. */
const MIN_REFETCH_INTERVAL_MS = 30_000;

const headerSchema = z.object({
  alg: z.string(),
  kid: z.string().min(1),
  typ: z.string().optional(),
});

const claimsSchema = z.object({
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  azp: z.string().optional(),
  sub: z.string().min(1).max(255),
  exp: z.number(),
  iat: z.number(),
  nonce: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  picture: z.string().optional(),
});
export type GoogleIdTokenClaims = z.infer<typeof claimsSchema>;

const jwksSchema = z.object({
  keys: z.array(
    z
      .object({
        kty: z.string(),
        kid: z.string(),
        n: z.string().optional(),
        e: z.string().optional(),
        alg: z.string().optional(),
        use: z.string().optional(),
      })
      .loose(),
  ),
});

export interface VerifyIdTokenOptions {
  audience: string;
  nonce: string;
  /** Epoch ms; defaults to Date.now() (tests pass a fixed clock). */
  now?: number;
}

/**
 * Verifies Google OIDC id_tokens (RS256) against Google's JWKS: signature, iss, aud, exp/iat, nonce.
 * Keys are cached in memory per process, honouring Cache-Control max-age.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly logger = new Logger(GoogleIdTokenVerifier.name);
  private keys = new Map<string, KeyObject>();
  private expiresAt = 0;
  private lastFetchAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(@Inject(OAUTH_HTTP) private readonly http: OAuthHttpClient) {}

  async verify(idToken: string, opts: VerifyIdTokenOptions): Promise<GoogleIdTokenClaims> {
    const fail = (msg: string): never => {
      throw new OAuthProviderError(AuthProvider.GOOGLE, `id_token ${msg}`);
    };
    const parts = idToken.split('.');
    if (parts.length !== 3) fail('is not a JWS');
    const [h, p, s] = parts as [string, string, string];
    const header = headerSchema.safeParse(decodeJson(h));
    if (!header.success) return fail('has an invalid header');
    if (header.data.alg !== 'RS256') fail(`uses unsupported alg ${header.data.alg}`);

    const key = await this.getKey(header.data.kid, opts.now ?? Date.now());
    if (!key) return fail('signed by an unknown key');
    const ok = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
    if (!ok) fail('signature is invalid');

    const claims = claimsSchema.safeParse(decodeJson(p));
    if (!claims.success) return fail('has invalid claims');
    const c = claims.data;
    const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
    if (!(GOOGLE_ISSUERS as readonly string[]).includes(c.iss)) fail('has a wrong issuer');
    const audiences = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!audiences.includes(opts.audience)) fail('has a wrong audience');
    if (audiences.length > 1 && c.azp !== opts.audience) fail('has a wrong azp');
    if (c.exp + CLOCK_SKEW_SECONDS < nowSec) fail('is expired');
    if (c.iat - CLOCK_SKEW_SECONDS > nowSec) fail('is issued in the future');
    if (!c.nonce || c.nonce !== opts.nonce) fail('nonce mismatch');
    return c;
  }

  private async getKey(kid: string, now: number): Promise<KeyObject | undefined> {
    const cached = now < this.expiresAt ? this.keys.get(kid) : undefined;
    if (cached) return cached;
    if (now - this.lastFetchAt >= MIN_REFETCH_INTERVAL_MS || now >= this.expiresAt) {
      this.inflight ??= this.refresh(now).finally(() => {
        this.inflight = null;
      });
      await this.inflight;
    }
    return this.keys.get(kid);
  }

  private async refresh(now: number): Promise<void> {
    this.lastFetchAt = now;
    const res = await this.http.request({ method: 'GET', url: GOOGLE_JWKS_URL });
    const parsed = jwksSchema.safeParse(res.body);
    if (res.status !== 200 || !parsed.success) {
      this.logger.warn({ status: res.status }, 'failed to fetch Google JWKS');
      return;
    }
    const keys = new Map<string, KeyObject>();
    for (const jwk of parsed.data.keys) {
      if (jwk.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig')) continue;
      try {
        keys.set(jwk.kid, createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' }));
      } catch {
        this.logger.warn({ kid: jwk.kid }, 'skipping unparseable Google JWK');
      }
    }
    this.keys = keys;
    this.expiresAt = now + maxAgeMs(res.headers['cache-control']);
  }
}

function decodeJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function maxAgeMs(cacheControl: string | undefined): number {
  const m = /max-age=(\d+)/i.exec(cacheControl ?? '');
  const seconds = m ? Number(m[1]) : NaN;
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, 24 * DEFAULT_JWKS_TTL_MS)
    : DEFAULT_JWKS_TTL_MS;
}
