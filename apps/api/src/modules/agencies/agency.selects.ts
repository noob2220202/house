import { Prisma } from '@prisma/client';
import { STATUS_HISTORY_LIMIT } from './constants';

/** Logo / cover media: what the public URL needs (+ deletedAt, a deleted file has no URL). */
const logoSelect = { select: { storageKey: true, variants: true, deletedAt: true } } as const;

export const agencySummarySelect = {
  id: true,
  name: true,
  representativeName: true,
  registrationNumber: true,
  phone: true,
  roadAddress: true,
  addressDetail: true,
  emdCode: true,
  lat: true,
  lng: true,
  specialties: true,
  activeListingCount: true,
  logo: logoSelect,
} satisfies Prisma.AgencySelect;
export type AgencySummaryRow = Prisma.AgencyGetPayload<{ select: typeof agencySummarySelect }>;

export const agencyProfileSelect = {
  ...agencySummarySelect,
  cover: logoSelect,
  mobile: true,
  email: true,
  jibunAddress: true,
  intro: true,
  businessHours: true,
  approvedAt: true,
  warningCount: true,
} satisfies Prisma.AgencySelect;
export type AgencyProfileRow = Prisma.AgencyGetPayload<{ select: typeof agencyProfileSelect }>;

export const agencyDocumentSelect = {
  id: true,
  type: true,
  mediaId: true,
  createdAt: true,
  media: { select: { mimeType: true, sizeBytes: true, originalFilename: true } },
} satisfies Prisma.AgencyDocumentSelect;
export type AgencyDocumentRow = Prisma.AgencyDocumentGetPayload<{
  select: typeof agencyDocumentSelect;
}>;

export const agencyStatusHistorySelect = {
  id: true,
  fromStatus: true,
  toStatus: true,
  reason: true,
  createdAt: true,
  decidedBy: { select: { id: true, name: true } },
} satisfies Prisma.AgencyStatusHistorySelect;

export const myAgencySelect = {
  ...agencySummarySelect,
  businessNumber: true,
  mobile: true,
  email: true,
  jibunAddress: true,
  zipCode: true,
  intro: true,
  businessHours: true,
  logoMediaId: true,
  coverMediaId: true,
  cover: logoSelect,
  status: true,
  statusReason: true,
  approvedAt: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
  documents: { select: agencyDocumentSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  statusHistory: {
    select: agencyStatusHistorySelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: STATUS_HISTORY_LIMIT,
  },
  _count: { select: { members: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.AgencySelect;
export type MyAgencyRow = Prisma.AgencyGetPayload<{ select: typeof myAgencySelect }>;

export const agencyMemberSelect = {
  id: true,
  userId: true,
  role: true,
  status: true,
  displayName: true,
  title: true,
  phone: true,
  isLicensed: true,
  licenseNumber: true,
  joinedAt: true,
  removedAt: true,
} satisfies Prisma.AgencyMemberSelect;
export type AgencyMemberRow = Prisma.AgencyMemberGetPayload<{ select: typeof agencyMemberSelect }>;

export const disclosureSelect = {
  id: true,
  name: true,
  roadAddress: true,
  addressDetail: true,
  phone: true,
  registrationNumber: true,
  representativeName: true,
} satisfies Prisma.AgencySelect;
