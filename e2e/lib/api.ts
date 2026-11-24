import { expect, type APIRequestContext, type BrowserContext } from 'playwright/test';
import { WEB_URL } from './env';

/**
 * JSON API helper bound to a browser context: requests go through the web origin
 * (`/api/v1/*` → next.config rewrite → api), so cookies set by the API land on the site's
 * cookie jar exactly as in the browser, and the page and these calls share one session.
 */
export class Api {
  csrfToken: string | null = null;

  constructor(
    readonly request: APIRequestContext,
    readonly origin: string = WEB_URL,
  ) {}

  static of(context: BrowserContext, origin: string = WEB_URL): Api {
    return new Api(context.request, origin);
  }

  async call<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    expected: number | number[] = [200, 201, 202, 204],
  ): Promise<T> {
    const res = await this.request.fetch(`${this.origin}/api/v1${path}`, {
      method,
      headers: {
        origin: this.origin,
        ...(this.csrfToken ? { 'x-csrf-token': this.csrfToken } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      data: body === undefined ? undefined : JSON.stringify(body),
    });
    const ok = (Array.isArray(expected) ? expected : [expected]).includes(res.status());
    const text = await res.text();
    expect(ok, `${method} ${path} → ${res.status()} ${text.slice(0, 500)}`).toBe(true);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.call<T>('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.call<T>('POST', path, body ?? {});
  }

  /** multipart upload (POST /media?purpose=…, POST /admin/media?purpose=…). */
  async upload<T = unknown>(
    path: string,
    file: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<T> {
    const res = await this.request.post(`${this.origin}/api/v1${path}`, {
      headers: {
        origin: this.origin,
        ...(this.csrfToken ? { 'x-csrf-token': this.csrfToken } : {}),
      },
      multipart: { file },
    });
    const text = await res.text();
    expect(res.ok(), `upload ${path} → ${res.status()} ${text.slice(0, 500)}`).toBe(true);
    return JSON.parse(text) as T;
  }

  /** Polls an endpoint until `done(body)` holds (media processing, async counters…). */
  async waitFor<T>(path: string, done: (body: T) => boolean, timeoutMs = 30_000): Promise<T> {
    let last: T | undefined;
    await expect
      .poll(
        async () => {
          last = await this.get<T>(path);
          return done(last);
        },
        { timeout: timeoutMs, intervals: [250, 500, 1000] },
      )
      .toBe(true);
    return last as T;
  }
}

export interface E2eLogin {
  userId: string;
  role: string;
  agencyId: string | null;
  created: boolean;
  csrfToken: string;
}

/**
 * TEST-ONLY login (POST /api/v1/e2e/login, enabled by NODE_ENV=test + E2E_FAKE_OAUTH=1 on the
 * api): starts a real member session for a seeded member, or creates a fresh USER member when
 * `nickname` is given (email must be @e2e.example.invalid).
 */
export async function loginAs(
  context: BrowserContext,
  email: string,
  opts: { nickname?: string } = {},
): Promise<{ api: Api; login: E2eLogin }> {
  const api = Api.of(context);
  const login = await api.post<E2eLogin>('/e2e/login', {
    email,
    ...(opts.nickname ? { create: { nickname: opts.nickname } } : {}),
  });
  api.csrfToken = login.csrfToken;
  return { api, login };
}

// ----------------------------------------------------------------- seed data lookups (public API)

export interface ListingSummaryLite {
  id: string;
  assetType: string;
  dealType: string;
  title: string | null;
  roadAddress: string;
  dong: string | null;
  complex: { id: string; name: string } | null;
  primaryAgency: { id: string; name: string };
}

interface Page<T> {
  items: T[];
  total: number;
}

export async function findListings(
  api: Api,
  query: Record<string, string>,
): Promise<ListingSummaryLite[]> {
  const qs = new URLSearchParams({ pageSize: '50', ...query }).toString();
  const page = await api.get<Page<ListingSummaryLite>>(`/listings?${qs}`);
  return page.items;
}

/** A published apartment listing that belongs to a complex (for the browse flow). */
export async function anyComplexListing(api: Api): Promise<ListingSummaryLite> {
  const items = await findListings(api, { assetTypes: 'APT' });
  const hit = items.find((l) => l.complex);
  expect(hit, 'demo seed should have published APT listings in a complex').toBeTruthy();
  return hit as ListingSummaryLite;
}

/** Current published version of a terms type (purpose consents, D8). */
export async function termsVersion(api: Api, type: string): Promise<string> {
  const doc = await api.get<{ version: string }>(`/terms/${type}`);
  return doc.version;
}

/**
 * A member session in its own API context (no browser), e.g. a broker preparing data while the
 * page under test stays anonymous. Dispose it at the end of the test.
 */
export async function apiSessionAs(
  pw: { request: { newContext: (o: { baseURL?: string }) => Promise<APIRequestContext> } },
  email: string,
  opts: { nickname?: string } = {},
): Promise<{ api: Api; login: E2eLogin; dispose: () => Promise<void> }> {
  const ctx = await pw.request.newContext({ baseURL: WEB_URL });
  const api = new Api(ctx);
  const login = await api.post<E2eLogin>('/e2e/login', {
    email,
    ...(opts.nickname ? { create: { nickname: opts.nickname } } : {}),
  });
  api.csrfToken = login.csrfToken;
  return { api, login, dispose: () => ctx.dispose() };
}

export interface AgencyListingLite {
  id: string;
  status: string;
  assetType: string;
  complex: { id: string; name: string } | null;
  property: { ho: string | null; dong: string | null };
}

/** One of the broker's ACTIVE complex listings that has a 호 recorded (private field). */
export async function activeListingWithHo(api: Api): Promise<AgencyListingLite> {
  const page = await api.get<{ items: { id: string; status: string; complex: unknown }[] }>(
    '/agency/listings?pageSize=100',
  );
  for (const row of page.items.filter((r) => r.status === 'ACTIVE' && r.complex)) {
    const detail = await api.get<AgencyListingLite>(`/agency/listings/${row.id}`);
    if (detail.property.ho) return detail;
  }
  throw new Error('no ACTIVE complex listing with a 호 in the broker seed data');
}
