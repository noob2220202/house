import {
  AssetType,
  DealType,
  ErrorCode,
  INQUIRY_LIMITS,
  InquiryAuthor,
  InquiryChannel,
  InquirySource,
  InquiryStatus,
  NotificationType,
  UserStatus,
} from '@house/shared';
import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import type { DailyCapService } from '../../common/throttle/daily-cap.service';
import { DAILY_CAPS } from '../../common/throttle/throttle.constants';
import type { AppConfig } from '../../config/app-config.service';
import type { PrismaTx } from '../../prisma/prisma.service';
import type { MediaService } from '../media/media.service';
import { listingTitle, phoneDigits, retentionCutoff } from './domain/customer';
import { canReply, InquiryMapper, preview } from './inquiry.mapper';
import type {
  AgencyInquiryDetailRow,
  InquiryListingRow,
  MyInquiryListRow,
} from './inquiry.selects';
import type { InquiryDirectory } from './ports/inquiry-directory.port';
import { PrismaInquiryNotifier } from './ports/inquiry-notifier.port';
import { inboxFilterWhere } from './services/agency-inquiries.service';
import { receivedBody } from './services/inquiries.service';
import { consumeInquiryCap } from './services/inquiry-caps';
import { InquiryVisitorService } from './services/inquiry-visitor.service';

const AGENCY = '0190a0b0-0000-7000-8000-000000000001';
const USER = '0190a0b0-0000-7000-8000-000000000002';
const NOW = new Date('2026-11-28T03:00:00.000Z');

const media = {
  url: (ref: { storageKey: string }, variant = 'large') => `/media/${ref.storageKey}@${variant}`,
} as unknown as MediaService;
const mapper = new InquiryMapper(media);

const listingRow = (patch: Partial<InquiryListingRow> = {}): InquiryListingRow => ({
  id: 'l1',
  title: null,
  assetType: AssetType.APT,
  dealType: DealType.JEONSE,
  salePrice: 40_000,
  deposit: 20_000,
  monthlyRent: 10,
  presalePrice: null,
  deletedAt: null,
  complex: { name: '신대 레이크파크' },
  property: { buildingName: null, roadAddress: '전남광주통합특별시 순천시 연향로 1' },
  photos: [{ media: { storageKey: 'p/cover.webp', variants: null } }],
  ...patch,
});

function agencyRow(patch: Partial<AgencyInquiryDetailRow> = {}): AgencyInquiryDetailRow {
  return {
    id: 'i1',
    channel: InquiryChannel.MESSAGE,
    status: InquiryStatus.NEW,
    source: InquirySource.SITE,
    userId: USER,
    customerName: '홍길동',
    customerPhone: '01012345678',
    message: '아직 있나요?',
    memo: null,
    readAt: null,
    lastMessageAt: NOW,
    piiScrubbedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    user: { status: UserStatus.ACTIVE },
    handledBy: { name: '김대표', agencyMemberships: [{ displayName: '김중개' }] },
    listing: listingRow(),
    messages: [
      {
        id: 'm1',
        author: InquiryAuthor.AGENCY,
        body: '네, 있어요.',
        authorName: '김중개',
        createdAt: NOW,
      },
    ],
    ...patch,
  };
}

describe('inquiry domain helpers', () => {
  it('extracts phone digits from a search term', () => {
    expect(phoneDigits('010-12')).toBe('01012');
    expect(phoneDigits('김')).toBeNull();
    expect(phoneDigits('5')).toBeNull();
  });

  it('names listings by title, else 단지, building, address', () => {
    expect(listingTitle(listingRow({ title: '남향 로얄층' }))).toBe('남향 로얄층');
    expect(listingTitle(listingRow())).toBe('신대 레이크파크');
    expect(listingTitle(listingRow({ complex: null }))).toBe('전남광주통합특별시 순천시 연향로 1');
  });

  it('cuts previews to one line', () => {
    expect(preview('  첫 줄\n둘째 줄  ')).toBe('첫 줄 둘째 줄');
    expect(preview('가'.repeat(81))).toBe(`${'가'.repeat(80)}…`);
    expect(preview(null)).toBe('');
  });

  it('retains for RETENTION_DAYS', () => {
    expect(retentionCutoff(NOW, INQUIRY_LIMITS.RETENTION_DAYS).toISOString()).toBe(
      '2025-11-28T03:00:00.000Z',
    );
  });

  it('never names the customer in the office notice', () => {
    expect(receivedBody({ id: 'l1', title: '신대 레이크파크' }, '사무소 홈페이지')).toBe(
      '매물 문의 · 신대 레이크파크',
    );
    expect(receivedBody(null, '사무소 홈페이지')).toBe('사무소 홈페이지에서 보낸 사무소 문의');
  });

  it('keeps the shared daily limit and the enforced cap equal', () => {
    expect(DAILY_CAPS.INQUIRY_CREATE).toBe(INQUIRY_LIMITS.DAILY_CAP);
  });
});

describe('canReply', () => {
  const base = {
    channel: InquiryChannel.MESSAGE,
    userId: USER,
    user: { status: UserStatus.ACTIVE },
    piiScrubbedAt: null,
  };
  it('only for written inquiries of members who still have an account', () => {
    expect(canReply(base)).toBe(true);
    expect(canReply({ ...base, userId: null, user: null })).toBe(false);
    expect(canReply({ ...base, channel: InquiryChannel.CALL })).toBe(false);
    expect(canReply({ ...base, user: { status: UserStatus.WITHDRAWN } })).toBe(false);
    expect(canReply({ ...base, piiScrubbedAt: NOW })).toBe(false);
  });
});

describe('InquiryMapper', () => {
  it('maps the console view with the thread, handler and listing card', () => {
    expect(mapper.agencyDetail(agencyRow())).toEqual({
      id: 'i1',
      channel: 'MESSAGE',
      status: 'NEW',
      source: 'SITE',
      listing: {
        id: 'l1',
        title: '신대 레이크파크',
        assetType: 'APT',
        dealType: 'JEONSE',
        // 전세: only the deposit applies.
        salePrice: null,
        deposit: 20_000,
        monthlyRent: null,
        presalePrice: null,
        coverPhotoUrl: '/media/p/cover.webp@thumb',
      },
      customerName: '홍길동',
      customerPhone: '01012345678',
      isMember: true,
      canReply: true,
      message: '아직 있나요?',
      memo: null,
      handledByName: '김중개',
      readAt: null,
      lastMessageAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      messages: [
        {
          id: 'm1',
          author: 'AGENCY',
          body: '네, 있어요.',
          authorName: '김중개',
          createdAt: NOW.toISOString(),
        },
      ],
    });
  });

  it('shows no phone on contact events, no card for deleted listings, guests cannot be answered', () => {
    const v = mapper.agency(
      agencyRow({
        channel: InquiryChannel.CALL,
        userId: null,
        user: null,
        customerName: null,
        message: null,
        handledBy: null,
        listing: listingRow({ deletedAt: NOW }),
      }),
    );
    expect(v).toMatchObject({
      customerPhone: null,
      listing: null,
      isMember: false,
      canReply: false,
      handledByName: null,
    });
    expect(v.messages).toBeUndefined();
  });

  it('flags unread replies for MY > 문의 내역', () => {
    const row: MyInquiryListRow = {
      id: 'i1',
      status: InquiryStatus.IN_PROGRESS,
      message: '처음 문의',
      customerReadAt: new Date(NOW.getTime() - 1000),
      lastMessageAt: NOW,
      createdAt: NOW,
      agency: { id: AGENCY, name: '순천공인', logo: null },
      listing: null,
      messages: [{ body: '네, 있어요.' }],
      _count: { messages: 1 },
    };
    expect(mapper.myListItem(row, NOW)).toMatchObject({
      preview: '네, 있어요.',
      replyCount: 1,
      hasUnreadReply: true,
      agency: { id: AGENCY, name: '순천공인', logoUrl: null },
    });
    expect(mapper.myListItem({ ...row, customerReadAt: NOW }, NOW).hasUnreadReply).toBe(false);
    expect(
      mapper.myListItem({ ...row, messages: [], _count: { messages: 0 } }, undefined),
    ).toMatchObject({ preview: '처음 문의', hasUnreadReply: false });
  });
});

describe('inboxFilterWhere', () => {
  it('scopes to the office, skips deleted rows and searches text and phone digits', () => {
    expect(inboxFilterWhere(AGENCY, {})).toEqual({ agencyId: AGENCY, deletedAt: null });
    const w = inboxFilterWhere(AGENCY, {
      channel: InquiryChannel.MESSAGE,
      source: InquirySource.MAIN,
      unread: true,
      q: '010-1234',
    });
    const and = w.AND as Prisma.InquiryWhereInput[];
    expect(and).toHaveLength(5);
    expect(and[3]).toEqual({ readAt: null });
    expect(and[4]?.OR).toContainEqual({ customerPhone: { contains: '0101234' } });
    const byName = inboxFilterWhere(AGENCY, { q: '홍' }).AND as Prisma.InquiryWhereInput[];
    expect(byName[1]?.OR).toHaveLength(7);
    // Every name the row's listing card can show (listingTitle) is searchable.
    expect(byName[1]?.OR).toEqual(
      expect.arrayContaining([
        { listing: { complex: { name: { contains: '홍', mode: 'insensitive' } } } },
        { listing: { property: { buildingName: { contains: '홍', mode: 'insensitive' } } } },
        { listing: { property: { roadAddress: { contains: '홍', mode: 'insensitive' } } } },
        { messages: { some: { body: { contains: '홍', mode: 'insensitive' } } } },
      ]),
    );
  });
});

describe('consumeInquiryCap', () => {
  it('answers INQUIRY_DAILY_LIMIT (429) instead of RATE_LIMITED', async () => {
    const caps = {
      consume: jest.fn().mockRejectedValue(new AppException(ErrorCode.RATE_LIMITED)),
    } as unknown as DailyCapService;
    const err = await consumeInquiryCap(caps, 'INQUIRY_CREATE', 'u:x', NOW).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).code).toBe(ErrorCode.INQUIRY_DAILY_LIMIT);
    expect((err as AppException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('passes other failures through', async () => {
    const boom = new Error('redis down');
    const caps = { consume: jest.fn().mockRejectedValue(boom) } as unknown as DailyCapService;
    await expect(consumeInquiryCap(caps, 'INQUIRY_FOLLOW_UP', 'u:x', NOW)).rejects.toBe(boom);
  });
});

describe('InquiryVisitorService', () => {
  const config = {
    get: () => 'test-only-cookie-secret-0123456789abcdefghijkl',
  } as unknown as AppConfig;
  const visitors = new InquiryVisitorService(config);

  it('identifies members by id and guests by a keyed hash of the address', () => {
    expect(
      visitors.current({
        kind: 'USER',
        userId: USER,
        role: 'USER',
        agencyId: null,
        sessionId: 's',
      }),
    ).toEqual({ userId: USER, visitorHash: null });
    const h = visitors.hashIp('203.0.113.7');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203');
    expect(visitors.hashIp('203.0.113.7')).toBe(h);
    expect(visitors.hashIp('203.0.113.8')).not.toBe(h);
    expect(visitors.hashIp(undefined)).toBeNull();
    // IPv4-mapped addresses are the IPv4 client.
    expect(visitors.hashIp('::ffff:203.0.113.7')).toBe(h);
    expect(visitors.subject({ userId: USER, visitorHash: h })).toBe(`u:${USER}`);
    expect(visitors.subject({ userId: null, visitorHash: h })).toBe(`ip:${h}`);
    expect(visitors.subject({ userId: null, visitorHash: null })).toBeNull();
  });

  it('keys an IPv6 guest by its /64, so rotating addresses inside it shares one cap and dedupe', () => {
    const a = visitors.hashIp('2001:db8:1:2::1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(visitors.hashIp('2001:db8:1:2:ffff:ffff:ffff:fffe')).toBe(a);
    expect(visitors.hashIp('2001:0DB8:0001:0002:aaaa::9')).toBe(a);
    expect(visitors.hashIp('2001:db8:1:3::1')).not.toBe(a);
    expect(visitors.hashIp('not an address')).toBeNull();
  });
});

describe('PrismaInquiryNotifier', () => {
  const directory = {
    memberUserIds: jest.fn().mockResolvedValue(['m1', 'm2', USER]),
  } as unknown as InquiryDirectory;
  const notifier = new PrismaInquiryNotifier(directory);

  it('tells every member of the office (agency feed) except the customer', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const db = { notification: { createMany } } as unknown as PrismaTx;
    await notifier.inquiryReceived(db, {
      agencyId: AGENCY,
      inquiryId: 'i1',
      title: 't',
      body: 'b',
      followUp: true,
      excludeUserId: USER,
    });
    const rows = (createMany.mock.calls[0]?.[0] as { data: Record<string, unknown>[] }).data;
    expect(rows.map((r) => r.userId)).toEqual(['m1', 'm2']);
    expect(rows[0]).toMatchObject({
      type: NotificationType.INQUIRY_RECEIVED,
      data: { agencyId: AGENCY, inquiryId: 'i1', followUp: true },
    });
  });

  it('sends the answer to the customer’s personal feed (no agencyId)', async () => {
    const create = jest.fn().mockResolvedValue({});
    const db = { notification: { create } } as unknown as PrismaTx;
    await notifier.inquiryReplied(db, {
      userId: USER,
      inquiryId: 'i1',
      agencyName: '순천공인',
      title: 't',
      body: 'b',
    });
    const data = (create.mock.calls[0]?.[0] as { data: { data: Record<string, unknown> } }).data;
    expect(data).toMatchObject({ userId: USER, type: NotificationType.INQUIRY_REPLIED });
    expect(data.data).toEqual({ inquiryId: 'i1', agencyName: '순천공인' });
  });
});
