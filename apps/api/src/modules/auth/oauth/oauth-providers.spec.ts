import { generateKeyPairSync, sign } from 'node:crypto';
import { AuthProvider } from '@house/shared';
import type { AppConfig } from '../../../config/app-config.service';
import { GOOGLE_JWKS_URL, GoogleIdTokenVerifier } from './google-id-token.verifier';
import type { OAuthHttpClient, OAuthHttpRequest, OAuthHttpResponse } from './oauth-http';
import {
  cleanEmail,
  cleanImageUrl,
  normalizeProviderPhone,
  type OAuthProvider,
  OAuthProviderError,
} from './oauth-provider';
import { OAuthProviderRegistry } from './oauth-registry';
import { pkceChallenge } from './oauth-state.store';
import { GoogleOAuthProvider } from './providers/google.provider';
import { KakaoOAuthProvider } from './providers/kakao.provider';
import { NaverOAuthProvider } from './providers/naver.provider';

const env: Record<string, string | undefined> = {
  API_BASE_URL: 'https://api.example.kr',
  KAKAO_CLIENT_ID: 'kakao-id',
  NAVER_CLIENT_ID: 'naver-id',
  NAVER_CLIENT_SECRET: 'naver-secret',
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
};
const config = (over: Record<string, string | undefined> = {}) =>
  ({ get: (k: string) => ({ ...env, ...over })[k] }) as unknown as AppConfig;

class StubHttp implements OAuthHttpClient {
  readonly calls: OAuthHttpRequest[] = [];
  constructor(private readonly handler: (r: OAuthHttpRequest) => OAuthHttpResponse) {}
  async request(r: OAuthHttpRequest): Promise<OAuthHttpResponse> {
    this.calls.push(r);
    return this.handler(r);
  }
}
const ok = (body: unknown, headers: Record<string, string> = {}) => ({
  status: 200,
  body,
  headers,
});

describe('provider helpers', () => {
  it('normalizes provider phones to canonical mobile digits (never verified)', () => {
    expect(normalizeProviderPhone('+82 10-1234-5678')).toBe('01012345678');
    expect(normalizeProviderPhone('010-1234-5678')).toBe('01012345678');
    expect(normalizeProviderPhone('+82 2-123-4567')).toBeNull();
    expect(normalizeProviderPhone(undefined)).toBeNull();
  });

  it('keeps only https images and sane emails', () => {
    expect(cleanImageUrl('http://k.kakaocdn.net/a.jpg')).toBe('https://k.kakaocdn.net/a.jpg');
    expect(cleanImageUrl('javascript:alert(1)')).toBeNull();
    expect(cleanEmail(' A@B.com ')).toBe('a@b.com');
    expect(cleanEmail('nope')).toBeNull();
  });

  it('PKCE challenge is base64url(sha256(verifier)) per RFC 7636', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('KakaoOAuthProvider', () => {
  it('exchanges the code and maps the profile', async () => {
    const http = new StubHttp((r) =>
      r.url.includes('/oauth/token')
        ? ok({ access_token: 'at', token_type: 'bearer' })
        : ok({
            id: 123456789,
            kakao_account: {
              profile: {
                nickname: ' 닉 ',
                profile_image_url: 'http://img',
                is_default_image: true,
              },
              email: 'x@kakao.com',
              is_email_valid: true,
              is_email_verified: true,
              phone_number: '+82 10-1111-2222',
            },
          }),
    );
    const p = new KakaoOAuthProvider(config(), http);
    expect(p.redirectUri()).toBe('https://api.example.kr/api/v1/auth/oauth/kakao/callback');
    const url = new URL(
      p.buildAuthorizeUrl({
        state: 's',
        nonce: 'n',
        codeChallenge: 'c',
        redirectUri: p.redirectUri(),
      }),
    );
    expect(url.searchParams.get('client_id')).toBe('kakao-id');
    const tokens = await p.exchangeCode({
      code: 'c',
      state: 's',
      codeVerifier: 'v',
      redirectUri: 'r',
    });
    expect(http.calls[0]?.form).not.toHaveProperty('client_secret');
    const profile = await p.fetchProfile(tokens);
    expect(profile).toEqual({
      provider: AuthProvider.KAKAO,
      providerUserId: '123456789',
      email: 'x@kakao.com',
      emailVerified: true,
      name: null,
      nickname: '닉',
      phone: '01011112222',
      profileImageUrl: null,
    });
    expect(http.calls[1]?.headers?.Authorization).toBe('Bearer at');
  });

  it('turns a rejected code into OAuthProviderError; disabled without a client id', async () => {
    const p = new KakaoOAuthProvider(
      config(),
      new StubHttp(() => ({ status: 400, body: {}, headers: {} })),
    );
    await expect(
      p.exchangeCode({ code: 'c', state: 's', codeVerifier: 'v', redirectUri: 'r' }),
    ).rejects.toBeInstanceOf(OAuthProviderError);
    expect(
      new KakaoOAuthProvider(
        config({ KAKAO_CLIENT_ID: undefined }),
        new StubHttp(() => ok({})),
      ).isEnabled(),
    ).toBe(false);
  });
});

describe('NaverOAuthProvider', () => {
  it('treats HTTP-200 token errors and non-00 result codes as failures', async () => {
    const p = new NaverOAuthProvider(
      config(),
      new StubHttp((r) =>
        r.url.includes('token') ? ok({ error: 'invalid_request' }) : ok({ resultcode: '024' }),
      ),
    );
    await expect(
      p.exchangeCode({ code: 'c', state: 's', codeVerifier: 'v', redirectUri: 'r' }),
    ).rejects.toThrow(/rejected/);
    await expect(p.fetchProfile({ accessToken: 'x' })).rejects.toBeInstanceOf(OAuthProviderError);
  });

  it('maps the profile (email never treated as verified)', async () => {
    const p = new NaverOAuthProvider(
      config(),
      new StubHttp(() =>
        ok({
          resultcode: '00',
          response: { id: 'abc', email: 'n@naver.com', mobile: '010-3333-4444', name: '홍길동' },
        }),
      ),
    );
    const profile = await p.fetchProfile({ accessToken: 'x' });
    expect(profile).toMatchObject({
      providerUserId: 'abc',
      email: 'n@naver.com',
      emailVerified: false,
      phone: '01033334444',
      name: '홍길동',
    });
  });
});

describe('GoogleIdTokenVerifier + GoogleOAuthProvider', () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig' };
  const now = Date.UTC(2026, 5, 1);
  const nowSec = Math.floor(now / 1000);

  const jwt = (claims: Record<string, unknown>, header: Record<string, unknown> = {}) => {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const h = enc({ alg: 'RS256', kid: 'k1', ...header });
    const b = enc(claims);
    return `${h}.${b}.${sign('RSA-SHA256', Buffer.from(`${h}.${b}`), keys.privateKey).toString('base64url')}`;
  };
  const base = {
    iss: 'https://accounts.google.com',
    aud: 'google-id',
    sub: 'sub-1',
    nonce: 'n-1',
    iat: nowSec,
    exp: nowSec + 600,
    email: 'u@gmail.com',
    email_verified: true,
  };

  function verifier() {
    const http = new StubHttp((r) =>
      r.url === GOOGLE_JWKS_URL ? ok({ keys: [jwk] }, { 'cache-control': 'max-age=100' }) : ok({}),
    );
    return { http, v: new GoogleIdTokenVerifier(http) };
  }

  it('verifies a valid token and caches the JWKS', async () => {
    const { http, v } = verifier();
    const c = await v.verify(jwt(base), { audience: 'google-id', nonce: 'n-1', now });
    expect(c.sub).toBe('sub-1');
    await v.verify(jwt(base), { audience: 'google-id', nonce: 'n-1', now: now + 1000 });
    expect(http.calls).toHaveLength(1);
  });

  it.each([
    ['wrong nonce', base, { nonce: 'other' }],
    ['wrong audience', { ...base, aud: 'x' }, {}],
    ['wrong issuer', { ...base, iss: 'https://evil' }, {}],
    ['expired', { ...base, exp: nowSec - 120 }, {}],
    ['issued in the future', { ...base, iat: nowSec + 600 }, {}],
    ['missing nonce', { ...base, nonce: undefined }, {}],
  ])('rejects %s', async (_name, claims, opts) => {
    const { v } = verifier();
    await expect(
      v.verify(jwt(claims), { audience: 'google-id', nonce: 'n-1', now, ...opts }),
    ).rejects.toBeInstanceOf(OAuthProviderError);
  });

  it('rejects alg confusion, unknown kid, bad signatures and garbage', async () => {
    const { v } = verifier();
    const opts = { audience: 'google-id', nonce: 'n-1', now };
    await expect(v.verify(jwt(base, { alg: 'HS256' }), opts)).rejects.toThrow(/alg/);
    await expect(v.verify(jwt(base, { kid: 'k2' }), opts)).rejects.toThrow(/unknown key/);
    const [h, b] = jwt(base).split('.');
    const forged = `${h}.${b}.${Buffer.from('x').toString('base64url')}`;
    await expect(v.verify(forged, opts)).rejects.toThrow(/signature/);
    await expect(v.verify('a.b', opts)).rejects.toThrow(/JWS/);
  });

  it('provider uses the verified id_token as the profile', async () => {
    const { v } = verifier();
    const spy = jest.spyOn(v, 'verify');
    const http = new StubHttp(() => ok({ access_token: 'at', id_token: jwt(base) }));
    const p = new GoogleOAuthProvider(config(), http, v);
    const url = new URL(
      p.buildAuthorizeUrl({ state: 's', nonce: 'n-1', codeChallenge: 'cc', redirectUri: 'r' }),
    );
    expect(url.searchParams.get('code_challenge')).toBe('cc');
    const tokens = await p.exchangeCode({
      code: 'c',
      state: 's',
      codeVerifier: 'ver',
      redirectUri: 'r',
    });
    expect(http.calls[0]?.form?.code_verifier).toBe('ver');
    spy.mockResolvedValueOnce({ ...base, name: '구글' });
    const profile = await p.fetchProfile(tokens, { nonce: 'n-1' });
    expect(spy).toHaveBeenCalledWith(tokens.idToken, { audience: 'google-id', nonce: 'n-1' });
    expect(profile).toMatchObject({ providerUserId: 'sub-1', emailVerified: true, phone: null });
  });
});

describe('OAuthProviderRegistry', () => {
  it('serves enabled providers only', () => {
    const fakeProvider = (provider: AuthProvider, enabled: boolean) =>
      ({ provider, isEnabled: () => enabled }) as unknown as OAuthProvider;
    const r = new OAuthProviderRegistry([
      fakeProvider(AuthProvider.KAKAO, true),
      fakeProvider(AuthProvider.NAVER, false),
    ]);
    expect(r.enabled()).toEqual([AuthProvider.KAKAO]);
    expect(r.get(AuthProvider.KAKAO).provider).toBe(AuthProvider.KAKAO);
    expect(() => r.get(AuthProvider.NAVER)).toThrow();
    expect(() => r.get(AuthProvider.GOOGLE)).toThrow();
  });
});
