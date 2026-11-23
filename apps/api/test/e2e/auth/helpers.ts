import { TermsType } from '@house/shared';
import type { Prisma, TermsDocument } from '@prisma/client';
import type { Response, Test } from 'supertest';
import { OAUTH_HTTP } from '../../../src/modules/auth/oauth/oauth-http';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { createTestApp, type TestApp } from '../../utils';
import { FakeOAuthHttp } from './fakes/fake-oauth-http';

export const WEB_ORIGIN = 'http://localhost:3000';
export const ADMIN_ORIGIN = 'http://localhost:3001';

export async function createAuthTestApp(): Promise<{ t: TestApp; fake: FakeOAuthHttp }> {
  const fake = new FakeOAuthHttp();
  const t = await createTestApp({
    override: (b) => b.overrideProvider(OAUTH_HTTP).useValue(fake),
  });
  return { t, fake };
}

/** name → value of every Set-Cookie on a response (cleared cookies have an empty value). */
export function setCookies(res: Response): Record<string, string> {
  const raw = res.headers['set-cookie'] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const out: Record<string, string> = {};
  for (const c of list) {
    const [pair = ''] = c.split(';');
    const idx = pair.indexOf('=');
    out[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
  }
  return out;
}

export function rawSetCookie(res: Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  return list.find((c) => c.startsWith(`${name}=`));
}

export function cookieHeader(cookies: Record<string, string | undefined>): string {
  return Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** Follows GET /auth/oauth/:slug/start and returns what the provider would receive. */
export async function startOAuth(
  t: TestApp,
  slug: string,
  opts: { query?: Record<string, string>; cookie?: string } = {},
): Promise<{ res: Response; location: URL; state: string; nonce: string; binding: string }> {
  let req = t
    .http()
    .get(`/api/v1/auth/oauth/${slug}/start`)
    .query(opts.query ?? {});
  if (opts.cookie) req = req.set('Cookie', opts.cookie);
  const res = await req.expect(302);
  const location = new URL(res.headers.location as string);
  const binding = setCookies(res).house_oauth;
  return {
    res,
    location,
    state: location.searchParams.get('state') ?? '',
    nonce: location.searchParams.get('nonce') ?? '',
    binding: binding ?? '',
  };
}

export function callback(
  t: TestApp,
  slug: string,
  query: Record<string, string>,
  cookies: Record<string, string | undefined>,
): Test {
  return t
    .http()
    .get(`/api/v1/auth/oauth/${slug}/callback`)
    .query(query)
    .set('Cookie', cookieHeader(cookies));
}

export function redirectTarget(res: Response): URL {
  return new URL(res.headers.location as string);
}

let termsSeq = 0;

export async function createTerms(
  prisma: PrismaService,
  data: Partial<Prisma.TermsDocumentUncheckedCreateInput> & { type: TermsType },
): Promise<TermsDocument> {
  termsSeq += 1;
  const past = new Date(Date.now() - 86_400_000);
  return prisma.termsDocument.create({
    data: {
      version: `1.${termsSeq}`,
      title: `${data.type} 약관`,
      content: `${data.type} 본문`,
      isRequired: data.type !== TermsType.MARKETING,
      effectiveAt: past,
      publishedAt: past,
      ...data,
    },
  });
}

/** 이용약관 / 개인정보 / 위치기반 (required) + 마케팅 (optional). */
export async function seedTerms(prisma: PrismaService) {
  return {
    service: await createTerms(prisma, { type: TermsType.SERVICE }),
    privacy: await createTerms(prisma, { type: TermsType.PRIVACY }),
    location: await createTerms(prisma, { type: TermsType.LOCATION }),
    marketing: await createTerms(prisma, { type: TermsType.MARKETING }),
  };
}
