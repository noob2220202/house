import { ErrorCode } from '@house/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { joinAgency, registerAgency } from '@/features/a-agency/api/queries';
import { dealApi } from '@/features/w-deal/api/client';
import { ApiError } from './errors';
import { fetchActionConsents } from './consents';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Current published version per terms type served by the stubbed GET /terms/:type. */
let versions: Record<string, string>;
const posted: { path: string; body: unknown }[] = [];

const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const url = new URL(input, 'http://localhost');
  const path = url.pathname.replace(/^.*\/api\/v1/, '');
  const terms = /^\/terms\/([A-Z_]+)$/.exec(path);
  if (terms) {
    const version = versions[terms[1] ?? ''];
    return version
      ? json(200, { id: 'd', type: terms[1], version, title: 't', isRequired: true })
      : json(404, { code: 'AUTH_TERMS_NOT_FOUND', message: '약관을 찾을 수 없습니다.' });
  }
  if (path === '/auth/csrf') return json(200, { csrfToken: 'csrf-token' });
  const body = typeof init?.body === 'string' ? init.body : 'null';
  posted.push({ path, body: JSON.parse(body) as unknown });
  if (path === '/deal-requests') return json(201, { id: 'req-1' });
  if (path === '/agencies/join')
    // MyAgencyMembership (agencies module)
    return json(200, {
      memberId: 'm',
      role: 'AGENT',
      displayName: '김하늘',
      agency: { id: 'a', name: '순천', status: 'APPROVED' },
    });
  return json(500, { code: 'INTERNAL_ERROR', message: 'unexpected' });
});

beforeEach(() => {
  versions = {
    PRIVACY_AGENCY_APPLICATION: '1.0',
    PRIVACY_AGENCY_JOIN: '1.1',
    DEAL_REQUEST_PRIVACY: '1.0',
    DEAL_REQUEST_PROVIDE: '2.0',
  };
  posted.length = 0;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

describe('fetchActionConsents (D8)', () => {
  it('returns the current version of every document the action needs', async () => {
    await expect(fetchActionConsents('DEAL_REQUEST')).resolves.toEqual([
      { type: 'DEAL_REQUEST_PRIVACY', version: '1.0' },
      { type: 'DEAL_REQUEST_PROVIDE', version: '2.0' },
    ]);
    await expect(fetchActionConsents('AGENCY_JOIN')).resolves.toEqual([
      { type: 'PRIVACY_AGENCY_JOIN', version: '1.1' },
    ]);
  });

  it('reports an unpublished document as AUTH_CONSENT_UNAVAILABLE', async () => {
    delete versions.DEAL_REQUEST_PROVIDE;
    const error = await fetchActionConsents('DEAL_REQUEST').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: ErrorCode.AUTH_CONSENT_UNAVAILABLE });
  });
});

describe('submissions send their consents', () => {
  it('POST /deal-requests carries both deal-request consents', async () => {
    await dealApi.create({
      type: 'WANTED',
      assetType: 'APT',
      dealTypes: ['SALE'],
      visibility: 'ALL_AGENCIES_IN_REGION',
      targetAgencyIds: [],
      contactName: '홍길동',
      contactPhone: '01012345678',
      regionCodes: ['12150'],
      complexIds: [],
    });
    expect(posted).toEqual([
      {
        path: '/deal-requests',
        body: expect.objectContaining({
          consents: [
            { type: 'DEAL_REQUEST_PRIVACY', version: '1.0' },
            { type: 'DEAL_REQUEST_PROVIDE', version: '2.0' },
          ],
        }) as unknown,
      },
    ]);
  });

  it('POST /agencies/join carries the join consent', async () => {
    await joinAgency('K7MQ4RXD');
    expect(posted).toEqual([
      {
        path: '/agencies/join',
        body: { code: 'K7MQ4RXD', consents: [{ type: 'PRIVACY_AGENCY_JOIN', version: '1.1' }] },
      },
    ]);
  });

  it('does not submit an application when its consent document is missing', async () => {
    delete versions.PRIVACY_AGENCY_APPLICATION;
    await expect(
      registerAgency({
        name: '조례한빛 공인중개사사무소',
        representativeName: '김하늘',
        registrationNumber: '46150-2026-00095',
        businessNumber: '0000000000',
        phone: '0610000000',
        roadAddress: '전남광주통합특별시 순천시 호수공원길 31',
        lat: 34.9573,
        lng: 127.5248,
        documents: [{ type: 'REGISTRATION_CERT', mediaId: '0b6f9a52-3c1d-4e8a-9f27-5d1c2b3a4e01' }],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.AUTH_CONSENT_UNAVAILABLE });
    expect(posted).toEqual([]);
  });
});
