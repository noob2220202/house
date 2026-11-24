import { AGENCY_INVITE_CODE_ALPHABET, AGENCY_INVITE_CODE_LENGTH } from '@house/shared';
import { Prisma } from '@prisma/client';
import { escapeLike } from './agency-search.repository';
import {
  BrokerRegistryUnavailableError,
  parseRegistryResponse,
  resolveVworldDomain,
  VworldBrokerRegistryClient,
} from './clients/broker-registry.client';
import type { AppConfig } from '../../config/app-config.service';
import { isUniqueViolation } from './domain/prisma-errors';
import { compareWithRegistry, normalizeOfficeName } from './domain/registry-compare';
import { toBusinessHours } from './agency.mapper';
import { filterFingerprint, tileAlignedBbox } from './services/agency-public.service';
import { generateInviteCode, hashInviteCode, toInviteView } from './services/agency-invite.store';

const REG = '46150-2020-00012';
const office = {
  jurirno: REG,
  bsnmCmpnm: '순천중앙 공인중개사사무소',
  brkrNm: '홍길동',
  sttusSeCode: '1',
  sttusSeCodeNm: '영업중',
  ldCodeNm: '전라남도 순천시',
  registDe: '2020-03-02',
};

describe('broker registry response parsing', () => {
  it('finds the office by 등록번호 (array or single object)', () => {
    const rec = parseRegistryResponse({ EBOfficeInfos: { field: [office] } }, REG);
    expect(rec).toEqual({
      registrationNumber: REG,
      officeName: '순천중앙 공인중개사사무소',
      representativeName: '홍길동',
      operating: true,
      statusLabel: '영업중',
      regionName: '전라남도 순천시',
      registeredOn: '2020-03-02',
    });
    expect(parseRegistryResponse({ EBOfficeInfos: { field: office } }, REG)?.officeName).toBe(
      '순천중앙 공인중개사사무소',
    );
  });

  it('matches the registry number regardless of hyphens', () => {
    const plain = { ...office, jurirno: '46150202000012' };
    expect(
      parseRegistryResponse({ EBOfficeInfos: { field: [plain] } }, REG)?.registrationNumber,
    ).toBe(REG);
    expect(
      parseRegistryResponse(
        { EBOfficeInfos: { field: [{ ...office, jurirno: '46150-2020-00013' }] } },
        REG,
      ),
    ).toBeNull();
  });

  it('returns null when absent and throws on unexpected payloads', () => {
    expect(parseRegistryResponse({ EBOfficeInfos: { field: [] } }, REG)).toBeNull();
    expect(parseRegistryResponse({}, REG)).toBeNull();
    expect(() => parseRegistryResponse('<xml/>', REG)).toThrow(BrokerRegistryUnavailableError);
  });

  it('treats the 브이월드 error envelope (e.g. a key bound to another domain) as unavailable', () => {
    const body = { response: { status: 'ERROR', error: { code: 'INCORRECT_KEY', text: '…' } } };
    expect(() => parseRegistryResponse(body, REG)).toThrow('registry error INCORRECT_KEY');
  });
});

describe('브이월드 broker registry client', () => {
  const config = (env: Record<string, string | undefined>) =>
    ({
      get: (k: string) => ({ PUBLIC_BASE_URL: 'https://brand.example', ...env })[k],
    }) as unknown as AppConfig;

  afterEach(() => jest.restoreAllMocks());

  it('resolves the registered domain from VWORLD_DOMAIN or PUBLIC_BASE_URL', () => {
    expect(resolveVworldDomain(undefined, 'https://brand.example/')).toBe('brand.example');
    expect(resolveVworldDomain(' ', 'https://brand.example')).toBe('brand.example');
    expect(resolveVworldDomain('https://www.brand.example/x', 'https://a.b')).toBe(
      'www.brand.example',
    );
    expect(resolveVworldDomain('www.brand.example', 'https://a.b')).toBe('www.brand.example');
  });

  it('is disabled without a key and refuses to call out', async () => {
    const client = new VworldBrokerRegistryClient(config({}));
    expect(client.enabled).toBe(false);
    const spy = jest.spyOn(globalThis, 'fetch');
    await expect(client.findByRegistrationNumber(REG, '46150')).rejects.toThrow(
      BrokerRegistryUnavailableError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls getEBOfficeInfo with key, domain, 시군구 ldCode and 등록번호, sending the domain as Referer', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ EBOfficeInfos: { field: [office] } }), { status: 200 }),
      );
    const client = new VworldBrokerRegistryClient(config({ VWORLD_API_KEY: 'k-123' }));
    const rec = await client.findByRegistrationNumber(REG, '46150');
    expect(rec?.officeName).toBe('순천중앙 공인중개사사무소');
    const [url, init] = spy.mock.calls[0] as [URL, RequestInit];
    expect(`${url.origin}${url.pathname}`).toBe('https://api.vworld.kr/ned/data/getEBOfficeInfo');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      key: 'k-123',
      domain: 'brand.example',
      ldCode: '46150',
      jurirno: REG,
      format: 'json',
    });
    expect(init.headers).toEqual({ Referer: 'https://brand.example/' });
  });

  it('maps HTTP failures and error envelopes to BrokerRegistryUnavailableError', async () => {
    const client = new VworldBrokerRegistryClient(config({ VWORLD_API_KEY: 'k' }));
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(client.findByRegistrationNumber(REG, '46150')).rejects.toThrow('HTTP 503');
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: { status: 'ERROR', error: { code: 'X' } } })),
      );
    await expect(client.findByRegistrationNumber(REG, '46150')).rejects.toThrow(
      BrokerRegistryUnavailableError,
    );
  });
});

describe('registry comparison', () => {
  const record = parseRegistryResponse({ EBOfficeInfos: { field: [office] } }, REG);

  it('ignores spacing and the generic 공인중개사사무소 suffix', () => {
    expect(normalizeOfficeName('순천중앙공인중개사')).toBe(
      normalizeOfficeName('순천중앙 공인중개사사무소'),
    );
    expect(
      compareWithRegistry(
        { name: '순천중앙공인중개사사무소', representativeName: '홍 길동' },
        record,
      ),
    ).toEqual({ status: 'MATCH', mismatches: [] });
  });

  it('reports mismatching fields and closed offices', () => {
    const closed = record && { ...record, operating: false };
    expect(
      compareWithRegistry({ name: '다른부동산', representativeName: '김철수' }, closed),
    ).toEqual({
      status: 'MISMATCH',
      mismatches: ['officeName', 'representativeName', 'operating'],
    });
    expect(compareWithRegistry({ name: 'x', representativeName: 'y' }, null).status).toBe(
      'NOT_FOUND',
    );
  });
});

describe('invite codes', () => {
  it('uses the unambiguous alphabet and fixed length', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(AGENCY_INVITE_CODE_LENGTH);
      expect([...code].every((c) => AGENCY_INVITE_CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(hashInviteCode('ABCDEFGHJK')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInviteCode('ABCDEFGHJK')).not.toBe(hashInviteCode('ABCDEFGHJL'));
  });

  it('never exposes the code hash and shows the code only when given', () => {
    const record = {
      id: 'a'.repeat(24),
      agencyId: 'agency',
      codeHash: 'secret-hash',
      codeHint: 'GHJK',
      label: null,
      createdByUserId: 'u',
      createdAt: 0,
      expiresAt: 1000,
    };
    expect(toInviteView(record)).toEqual({
      id: record.id,
      codeHint: 'GHJK',
      label: null,
      createdAt: '1970-01-01T00:00:00.000Z',
      expiresAt: '1970-01-01T00:00:01.000Z',
    });
    expect(toInviteView(record, 'ABCDEFGHJK').code).toBe('ABCDEFGHJK');
  });
});

describe('map helpers', () => {
  it('aligns bboxes outward to tile boundaries', () => {
    const b = { swLng: 127.41, swLat: 34.91, neLng: 127.52, neLat: 35.01 };
    const t = tileAlignedBbox(b, 13);
    expect(t.swLng).toBeLessThanOrEqual(b.swLng);
    expect(t.swLat).toBeLessThanOrEqual(b.swLat);
    expect(t.neLng).toBeGreaterThanOrEqual(b.neLng);
    expect(t.neLat).toBeGreaterThanOrEqual(b.neLat);
    expect(tileAlignedBbox({ ...b, swLng: 127.411 }, 13)).toEqual(t);
  });

  it('fingerprints filters order-insensitively', () => {
    expect(filterFingerprint({ specialties: ['APT', 'LAND'] })).toBe(
      filterFingerprint({ specialties: ['LAND', 'APT'] }),
    );
    expect(filterFingerprint({ q: 'a' })).not.toBe(filterFingerprint({ q: 'b' }));
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\');
  });
});

describe('mapping helpers', () => {
  it('drops malformed business hours', () => {
    expect(toBusinessHours({ mon: { open: '09:00', close: '18:00' } })).toEqual({
      mon: { open: '09:00', close: '18:00' },
    });
    expect(toBusinessHours({ mon: 'always' })).toBeNull();
    expect(toBusinessHours(null)).toBeNull();
  });

  it('detects unique violations by field', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['registration_number'] },
    });
    expect(isUniqueViolation(err, 'registrationNumber')).toBe(true);
    expect(isUniqueViolation(err, 'email')).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });
});
