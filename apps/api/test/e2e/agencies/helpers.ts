import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AgencyDocumentType,
  AgencyMemberRole,
  AgencySiteStatus,
  SubscriptionProduct,
  AgencyStatus,
  type BrokerRegistryRecord,
  DEFAULT_MAP_CENTER,
  MediaPurpose,
  MediaVisibility,
  UserRole,
} from '@house/shared';
import type { Agency, AgencySite, AgencySubscription, Media, Prisma, User } from '@prisma/client';
import {
  BrokerRegistryUnavailableError,
  type BrokerRegistryClient,
} from '../../../src/modules/agencies/clients/broker-registry.client';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { actionConsents, createAgency, createMedia, createUser } from '../../utils';

/** A READY private 등록증 upload owned by `userId`. */
export function createDocumentMedia(
  prisma: PrismaService,
  userId: string,
  data: Partial<Parameters<typeof createMedia>[1]> = {},
): Promise<Media> {
  return createMedia(prisma, {
    purpose: MediaPurpose.AGENCY_DOCUMENT,
    visibility: MediaVisibility.PRIVATE,
    mimeType: 'application/pdf',
    ownerUserId: userId,
    storageKey: `docs/${Math.random().toString(36).slice(2)}.pdf`,
    originalFilename: '등록증.pdf',
    ...data,
  });
}

/** Writes the media's file under PRIVATE_UPLOAD_DIR so the admin download can stream it. */
export async function writePrivateFile(media: Media, content: Buffer | string): Promise<void> {
  const root = process.env.PRIVATE_UPLOAD_DIR;
  if (!root) throw new Error('PRIVATE_UPLOAD_DIR is not set');
  const file = path.join(root, media.storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

let regSeq = 0;
export function nextRegistrationNumber(): string {
  regSeq += 1;
  return `46150-2026-${String(10000 + regSeq).padStart(5, '0')}`;
}

/** Valid 사업자등록번호 with a correct check digit. */
export const VALID_BUSINESS_NUMBER = '220-81-62517';

export function registerBody(mediaId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: '순천중앙공인중개사사무소',
    representativeName: '홍길동',
    registrationNumber: nextRegistrationNumber(),
    businessNumber: VALID_BUSINESS_NUMBER,
    phone: '061-749-1234',
    mobile: '010-1234-5678',
    roadAddress: '전남광주통합특별시 순천시 중앙로 100',
    addressDetail: '1층',
    emdCode: '12150101',
    lat: DEFAULT_MAP_CENTER.lat,
    lng: DEFAULT_MAP_CENTER.lng,
    intro: '순천 아파트 전문',
    businessHours: { mon: { open: '09:00', close: '18:00' }, sun: null },
    specialties: ['APT', 'ONEROOM'],
    documents: [{ type: AgencyDocumentType.REGISTRATION_CERT, mediaId }],
    consents: actionConsents('AGENCY_APPLICATION'),
    ...overrides,
  };
}

/** A PENDING agency (owner still role USER) with one 등록증 document. */
export async function createPendingAgency(
  prisma: PrismaService,
  data: Partial<Parameters<typeof createAgency>[1]> = {},
): Promise<{ agency: Agency; owner: User; document: Media }> {
  const owner = await createUser(prisma, { role: UserRole.USER });
  const { agency } = await createAgency(prisma, {
    status: AgencyStatus.PENDING,
    approvedAt: null,
    ownerUserId: owner.id,
    businessNumber: '2208162517',
    ...data,
  });
  const document = await createDocumentMedia(prisma, owner.id);
  await prisma.agencyDocument.create({
    data: {
      agencyId: agency.id,
      type: AgencyDocumentType.REGISTRATION_CERT,
      mediaId: document.id,
      uploadedById: owner.id,
    },
  });
  return { agency, owner, document };
}

/** An AGENT member (user role AGENT) of `agencyId`. */
export async function createAgent(
  prisma: PrismaService,
  agencyId: string,
): Promise<{ user: User; memberId: string }> {
  const user = await createUser(prisma, { role: UserRole.AGENT });
  const member = await prisma.agencyMember.create({
    data: {
      agencyId,
      userId: user.id,
      role: AgencyMemberRole.AGENT,
      displayName: '김실장',
      phone: '01099998888',
    },
  });
  return { user, memberId: member.id };
}

/** Controllable registry fake (tests never call data.go.kr). */
export class FakeBrokerRegistry implements BrokerRegistryClient {
  enabled = true;
  calls = 0;
  records = new Map<string, BrokerRegistryRecord>();
  fail = false;

  findByRegistrationNumber(registrationNumber: string): Promise<BrokerRegistryRecord | null> {
    this.calls += 1;
    if (this.fail) return Promise.reject(new BrokerRegistryUnavailableError('down'));
    return Promise.resolve(this.records.get(registrationNumber) ?? null);
  }

  reset(): void {
    this.enabled = true;
    this.calls = 0;
    this.records.clear();
    this.fail = false;
  }
}

/** `list.map((x) => x[key])` for untyped response bodies. */
export function pluck(list: unknown, key: string): unknown[] {
  if (!Array.isArray(list)) throw new Error('expected an array');
  return (list as Record<string, unknown>[]).map((item) => item[key]);
}

/**
 * An office site row (default: ACTIVE with an approved slug and https ready). Pass
 * `status: 'REQUESTED', slug: null` for a pending request.
 */
export function createAgencySite(
  prisma: PrismaService,
  agencyId: string,
  data: Partial<Prisma.AgencySiteUncheckedCreateInput> = {},
): Promise<AgencySite> {
  const status = data.status ?? AgencySiteStatus.ACTIVE;
  const label = `office-${Math.random().toString(36).slice(2, 8)}`;
  const approved = status === AgencySiteStatus.ACTIVE || status === AgencySiteStatus.SUSPENDED;
  const slug = data.slug !== undefined ? data.slug : approved ? label : null;
  return prisma.agencySite.create({
    data: {
      agencyId,
      requestedAt: new Date(Date.now() - 60_000),
      decidedAt: status === AgencySiteStatus.REQUESTED ? null : new Date(),
      httpsReadyAt: status === AgencySiteStatus.ACTIVE ? new Date() : null,
      ...data,
      status,
      slug,
      requestedSlug: data.requestedSlug !== undefined ? data.requestedSlug : (slug ?? label),
    },
  });
}

/** An 이용권 period ("YYYY-MM-DD" days; endsOn null = open-ended). */
export function createSubscription(
  prisma: PrismaService,
  agencyId: string,
  data: { product?: SubscriptionProduct; startsOn: string; endsOn?: string | null } & Partial<
    Omit<Prisma.AgencySubscriptionUncheckedCreateInput, 'startsOn' | 'endsOn' | 'product'>
  >,
): Promise<AgencySubscription> {
  const { product, startsOn, endsOn, ...rest } = data;
  return prisma.agencySubscription.create({
    data: {
      agencyId,
      product: product ?? SubscriptionProduct.SITE,
      startsOn: new Date(`${startsOn}T00:00:00Z`),
      endsOn: endsOn ? new Date(`${endsOn}T00:00:00Z`) : null,
      ...rest,
    },
  });
}
