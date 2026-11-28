import { ERROR_MESSAGES, ErrorCode } from '../errors';
import {
  agencyInquiryDeleteSchema,
  agencyInquiryListQuerySchema,
  agencyInquiryReadAllSchema,
  agencyInquiryUpdateSchema,
  inquiryContactEventSchema,
  inquiryCreateSchema,
  inquiryReplySchema,
} from './schemas';

const AGENCY = '0190a0b0-0000-7000-8000-000000000001';
const LISTING = '0190a0b0-0000-7000-8000-000000000002';

const base = {
  agencyId: AGENCY,
  name: ' 홍길동 ',
  phone: '010-1234-5678',
  message: '  이 매물 아직 있나요?  ',
  source: 'MAIN',
};

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('inquiryCreateSchema', () => {
  it('trims, normalises the phone and defaults consents', () => {
    expect(inquiryCreateSchema.parse({ ...base, listingId: LISTING })).toEqual({
      agencyId: AGENCY,
      listingId: LISTING,
      name: '홍길동',
      phone: '01012345678',
      message: '이 매물 아직 있나요?',
      source: 'MAIN',
      consents: [],
    });
  });

  it('accepts a landline, no phone (members) and the office itself (no listing)', () => {
    expect(inquiryCreateSchema.parse({ ...base, phone: '061-749-1234' }).phone).toBe('0617491234');
    expect(inquiryCreateSchema.parse({ ...base, phone: null }).phone).toBeNull();
    const { phone: _p, ...noPhone } = base;
    expect(inquiryCreateSchema.parse(noPhone).listingId).toBeUndefined();
  });

  it('takes only the INQUIRY consent, once', () => {
    const consent = { type: 'INQUIRY_PRIVACY', version: '1.0' };
    expect(inquiryCreateSchema.parse({ ...base, consents: [consent] }).consents).toEqual([consent]);
    expect(
      paths(inquiryCreateSchema.safeParse({ ...base, consents: [consent, consent] }))[0],
    ).toMatch(/^consents/);
    expect(
      paths(
        inquiryCreateSchema.safeParse({ ...base, consents: [{ type: 'MARKETING', version: '1' }] }),
      )[0],
    ).toMatch(/^consents/);
  });

  it.each([
    ['name', { name: '   ' }],
    ['name', { name: 'a'.repeat(31) }],
    ['message', { message: '안녕' }],
    ['message', { message: 'a'.repeat(1001) }],
    ['phone', { phone: '12345' }],
    ['source', { source: 'APP' }],
    ['agencyId', { agencyId: 'x' }],
    ['listingId', { listingId: 'x' }],
  ])('refuses a bad %s', (path, patch) => {
    expect(paths(inquiryCreateSchema.safeParse({ ...base, ...patch }))).toEqual([path]);
  });

  it('lets the honeypot through so the server answers INQUIRY_REJECTED', () => {
    expect(inquiryCreateSchema.parse({ ...base, website: 'http://spam' }).website).toBe(
      'http://spam',
    );
  });
});

describe('other inquiry schemas', () => {
  it('logs contact events for CALL / SMS / COPY only', () => {
    expect(
      inquiryContactEventSchema.parse({ agencyId: AGENCY, channel: 'CALL', source: 'SITE' }),
    ).toEqual({ agencyId: AGENCY, channel: 'CALL', source: 'SITE' });
    expect(
      inquiryContactEventSchema.safeParse({ agencyId: AGENCY, channel: 'MESSAGE', source: 'SITE' })
        .success,
    ).toBe(false);
  });

  it('pages the inbox 12 by default, at most 50', () => {
    expect(agencyInquiryListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
    expect(
      agencyInquiryListQuerySchema.parse({
        unread: 'true',
        status: 'NEW',
        q: ' 김 ',
        pageSize: '50',
      }),
    ).toEqual({ unread: true, status: 'NEW', q: '김', page: 1, pageSize: 50 });
    expect(agencyInquiryListQuerySchema.safeParse({ pageSize: '51' }).success).toBe(false);
    expect(agencyInquiryListQuerySchema.safeParse({ q: 'a'.repeat(51) }).success).toBe(false);
    expect(agencyInquiryListQuerySchema.safeParse({ channel: 'FAX' }).success).toBe(false);
  });

  it('updates status / memo / read, at least one', () => {
    expect(agencyInquiryUpdateSchema.parse({ memo: '' })).toEqual({ memo: null });
    expect(agencyInquiryUpdateSchema.parse({ status: 'DONE', read: true })).toEqual({
      status: 'DONE',
      read: true,
    });
    expect(agencyInquiryUpdateSchema.safeParse({}).success).toBe(false);
    expect(agencyInquiryUpdateSchema.safeParse({ memo: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('replies 1–1000 chars, read-all needs all:true, delete body is optional', () => {
    expect(inquiryReplySchema.parse({ message: ' 네, 있어요. ' })).toEqual({
      message: '네, 있어요.',
    });
    expect(inquiryReplySchema.safeParse({ message: ' ' }).success).toBe(false);
    expect(inquiryReplySchema.safeParse({ message: 'a'.repeat(1001) }).success).toBe(false);
    expect(agencyInquiryReadAllSchema.safeParse({ all: true }).success).toBe(true);
    expect(agencyInquiryReadAllSchema.safeParse({ all: false }).success).toBe(false);
    expect(agencyInquiryDeleteSchema.parse(undefined)).toEqual({});
    expect(agencyInquiryDeleteSchema.parse({ reason: ' 스팸 ' })).toEqual({ reason: '스팸' });
    expect(agencyInquiryDeleteSchema.safeParse({ reason: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe('inquiry and office-site error codes', () => {
  it.each([
    'INQUIRY_NOT_FOUND',
    'INQUIRY_AGENCY_NOT_FOUND',
    'INQUIRY_LISTING_NOT_FOUND',
    'INQUIRY_PHONE_REQUIRED',
    'INQUIRY_REPLY_NOT_ALLOWED',
    'INQUIRY_REJECTED',
    'INQUIRY_DAILY_LIMIT',
    'AGENCY_SITE_NOT_FOUND',
    'AGENCY_SITE_SLUG_INVALID',
    'AGENCY_SITE_SLUG_RESERVED',
    'AGENCY_SITE_SLUG_DUPLICATE',
    'AGENCY_SITE_ALREADY_ACTIVE',
    'AGENCY_SITE_INVALID_TRANSITION',
    'AGENCY_SUBSCRIPTION_NOT_FOUND',
    'AGENCY_SUBSCRIPTION_INVALID_PERIOD',
  ])('%s is registered with a Korean message', (code) => {
    expect((ErrorCode as Record<string, string>)[code]).toBe(code);
    expect(ERROR_MESSAGES[code as ErrorCode]).toMatch(/[가-힣]/);
  });
});
