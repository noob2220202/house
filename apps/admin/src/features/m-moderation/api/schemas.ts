import {
  AgencyDocumentType,
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  AssetType,
  AuditActorType,
  AuthProvider,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  Direction,
  FloorClass,
  ListingAgencyStatus,
  ListingOption,
  ListingStatus,
  MoveInType,
  ProposalStatus,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  TermsType,
  UserRole,
  UserStatus,
  VerificationMethod,
} from '@house/shared';
import { z } from 'zod';

/**
 * Response contracts of the moderation back-office (`/api/v1/admin/{agencies,listings,reports,
 * deal-requests,users}`). The admin controllers are not implemented yet, so every shape here is an
 * ASSUMPTION derived from the Prisma models + module READMEs — see
 * docs/frontend-integration/m-moderation.md. Each response is parsed by exactly one schema below;
 * reconcile the schema and the mock fixture together.
 */

const str = z.string();
const iso = z.string();
/** Optional field: the API may omit it or send null. */
const opt = <T extends z.ZodType>(schema: T) => schema.nullish();

/** Backend pagination envelope `{ items, page, pageSize, total, totalPages }`. */
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------- agencies -------------------------------------------------------------------------

/** Result of the 국가공간정보 중개업소 조회 lookup for an application. */
export const RegistryCheckStatus = {
  MATCHED: 'MATCHED',
  MISMATCH: 'MISMATCH',
  NOT_FOUND: 'NOT_FOUND',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type RegistryCheckStatus = (typeof RegistryCheckStatus)[keyof typeof RegistryCheckStatus];

const registryCheckModel = z.object({
  status: z.enum(RegistryCheckStatus),
  checkedAt: iso,
  /** Data source label, e.g. "국가공간정보 중개업소 조회". */
  source: opt(str),
  /** What the registry holds for the registration number (absent when NOT_FOUND / UNAVAILABLE). */
  registry: opt(
    z.object({
      name: opt(str),
      representativeName: opt(str),
      registrationNumber: opt(str),
      roadAddress: opt(str),
      /** 영업중 / 휴업 / 폐업 … (free text from the registry). */
      businessStatus: opt(str),
      registeredAt: opt(str),
    }),
  ),
  /** Application fields that differ from the registry (`name`, `representativeName`, `roadAddress` …). */
  mismatches: z.array(str).default([]),
  message: opt(str),
});

/** Shared `RegistryMismatchField` → the row keys of the comparison table. */
const MISMATCH_FIELD: Record<string, string> = {
  officeName: 'name',
  representativeName: 'representativeName',
  operating: 'businessStatus',
};

/**
 * GET /admin/agencies/:id/registry-check(?refresh=1) answers the shared `AgencyRegistryCheck`
 * (`status: MATCH | …`, `record`, `mismatches: officeName | representativeName | operating`);
 * mapped onto the screen model (`MATCHED`, `registry`, table row keys). The model shape is still
 * accepted as is (mock fixtures, the dashboard queue).
 */
export function normalizeRegistryCheck(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !('record' in raw)) return raw;
  const v = raw as {
    status?: string;
    checkedAt?: string;
    record?: {
      registrationNumber?: string;
      officeName?: string;
      representativeName?: string | null;
      operating?: boolean;
      statusLabel?: string | null;
      registeredOn?: string | null;
    } | null;
    mismatches?: string[];
  };
  const r = v.record;
  return {
    status: v.status === 'MATCH' ? RegistryCheckStatus.MATCHED : v.status,
    checkedAt: v.checkedAt,
    source: '국가공간정보 중개업소 조회',
    registry: r
      ? {
          name: r.officeName ?? null,
          representativeName: r.representativeName ?? null,
          registrationNumber: r.registrationNumber ?? null,
          roadAddress: null,
          businessStatus: r.statusLabel ?? (r.operating ? '영업중' : '영업 중 아님'),
          registeredAt: r.registeredOn ?? null,
        }
      : null,
    mismatches: (v.mismatches ?? []).map((m) => MISMATCH_FIELD[m] ?? m),
    message:
      v.status === 'UNAVAILABLE'
        ? '등록 정보 조회 서비스에 연결하지 못했어요. 잠시 후 다시 조회해 주세요.'
        : null,
  };
}

export const registryCheckSchema = z.preprocess(normalizeRegistryCheck, registryCheckModel);
export type RegistryCheck = z.infer<typeof registryCheckSchema>;

export const adminAgencyDocumentSchema = z.object({
  id: str,
  type: z.enum(AgencyDocumentType),
  mediaId: opt(str),
  /** `originalFilename` in the shared `AgencyDocumentView` (mapped by the detail schema). */
  fileName: opt(str),
  mimeType: opt(str),
  sizeBytes: opt(z.number()),
  createdAt: iso,
});
export type AdminAgencyDocument = z.infer<typeof adminAgencyDocumentSchema>;

const adminAgencyListItemModel = z.object({
  id: str,
  name: str,
  representativeName: str,
  registrationNumber: str,
  phone: opt(str),
  roadAddress: str,
  /** 읍면동 name (not in the shared list view; the screens fall back to the address). */
  emdName: opt(str),
  status: z.enum(AgencyStatus),
  statusReason: opt(str),
  createdAt: iso,
  approvedAt: opt(iso),
  suspendedAt: opt(iso),
  /** Not in the shared list view (null = unknown); the detail has it. */
  activeListingCount: z.number().nullable().default(null),
  warningCount: z.number().default(0),
  /** Submitted documents (shared `AdminAgencyListItem.documentCount`). */
  documentCount: z.number().nullable().default(null),
  /**
   * Types of the documents submitted so far; null when only the count is known (the list view) —
   * the detail derives them from `documents`.
   */
  documentTypes: z.array(z.enum(AgencyDocumentType)).nullable().default(null),
  registryStatus: opt(z.enum(RegistryCheckStatus)),
});

/** Shared `AdminAgencyListItem` (GET /admin/agencies) → the list model. */
export const adminAgencyListItemSchema = adminAgencyListItemModel;
export type AdminAgencyListItem = z.infer<typeof adminAgencyListItemSchema>;
export const adminAgencyPageSchema = pageOf(adminAgencyListItemSchema);

const adminAgencyDetailModel = adminAgencyListItemModel.extend({
  businessNumber: opt(str),
  mobile: opt(str),
  email: opt(str),
  jibunAddress: opt(str),
  addressDetail: opt(str),
  zipCode: opt(str),
  lat: opt(z.number()),
  lng: opt(z.number()),
  intro: opt(str),
  specialties: z.array(z.enum(AssetType)).default([]),
  viewCount: z.number().default(0),
  updatedAt: opt(iso),
  owner: opt(
    z.object({
      id: str,
      name: opt(str),
      nickname: opt(str),
      email: opt(str),
      phone: opt(str),
      createdAt: opt(iso),
      providers: z.array(z.enum(AuthProvider)).default([]),
    }),
  ),
  documents: z.array(adminAgencyDocumentSchema).default([]),
  registryCheck: opt(registryCheckSchema),
  statusHistory: z
    .array(
      z.object({
        id: str,
        fromStatus: opt(z.enum(AgencyStatus)),
        toStatus: z.enum(AgencyStatus),
        reason: opt(str),
        decidedByName: opt(str),
        createdAt: iso,
      }),
    )
    .default([]),
  warnings: z
    .array(
      z.object({
        id: str,
        reason: str,
        reportId: opt(str),
        adminName: opt(str),
        createdAt: iso,
      }),
    )
    .default([]),
  members: z
    .array(
      z.object({
        id: str,
        displayName: str,
        role: z.enum(AgencyMemberRole),
        status: z.enum(AgencyMemberStatus),
        title: opt(str),
        isLicensed: z.boolean().default(false),
        joinedAt: opt(iso),
      }),
    )
    .default([]),
});
/**
 * Shared `AdminAgencyDetail` (GET /admin/agencies/:id, decision response) → the detail model:
 * `documents[].originalFilename` → `fileName`, `statusHistory[].decidedBy.name` →
 * `decidedByName`, `recentWarnings` → `warnings`, document types from `documents`. The registry
 * check is not part of the detail (GET …/registry-check, merged by the screen).
 */
export function normalizeAgencyDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const v = raw as Record<string, unknown> & {
    documents?: (Record<string, unknown> & { type?: string; originalFilename?: string | null })[];
    statusHistory?: (Record<string, unknown> & { decidedBy?: { name?: string } | null })[];
    recentWarnings?: unknown[];
  };
  const documents = Array.isArray(v.documents)
    ? v.documents.map((d) => ({ ...d, fileName: d.fileName ?? d.originalFilename ?? null }))
    : v.documents;
  return {
    ...v,
    documents,
    documentTypes:
      v.documentTypes ??
      (Array.isArray(documents) ? [...new Set(documents.map((d) => d.type))] : undefined),
    statusHistory: Array.isArray(v.statusHistory)
      ? v.statusHistory.map((h) => ({
          ...h,
          decidedByName: h.decidedByName ?? h.decidedBy?.name ?? null,
        }))
      : v.statusHistory,
    warnings: v.warnings ?? v.recentWarnings,
  };
}

export const adminAgencyDetailSchema = z.preprocess(normalizeAgencyDetail, adminAgencyDetailModel);
export type AdminAgencyDetail = z.infer<typeof adminAgencyDetailSchema>;

// ---------- listings -------------------------------------------------------------------------

/** Why a listing sits in the 검수 필요 queue. */
export const ListingReviewFlag = {
  REPORTED: 'REPORTED',
  UNVERIFIED: 'UNVERIFIED',
  VERIFICATION_EXPIRED: 'VERIFICATION_EXPIRED',
  PRICE_OUTLIER: 'PRICE_OUTLIER',
} as const;
export type ListingReviewFlag = (typeof ListingReviewFlag)[keyof typeof ListingReviewFlag];

const listingPriceShape = {
  dealType: z.enum(DealType),
  salePrice: opt(z.number()),
  deposit: opt(z.number()),
  monthlyRent: opt(z.number()),
  presalePrice: opt(z.number()),
  premium: opt(z.number()),
};

export const adminListingListItemSchema = z.object({
  id: str,
  title: opt(str),
  assetType: z.enum(AssetType),
  status: z.enum(ListingStatus),
  ...listingPriceShape,
  complexName: opt(str),
  buildingName: opt(str),
  dong: opt(str),
  emdName: opt(str),
  /** ㎡. 공급면적 drives the 평형 label (34평), 전용면적 the legal figure. */
  supplyArea: opt(z.number()),
  exclusiveArea: opt(z.number()),
  floorClass: opt(z.enum(FloorClass)),
  floor: opt(z.number()),
  totalFloors: opt(z.number()),
  primaryAgency: z.object({ id: str, name: str }),
  /** Number of co-brokering offices (ACTIVE ListingAgency rows). */
  agencyCount: z.number().default(1),
  photoCount: z.number().default(0),
  coverUrl: opt(str),
  verifiedAt: opt(iso),
  publishedAt: opt(iso),
  expiresAt: opt(iso),
  closedAt: opt(iso),
  createdAt: iso,
  updatedAt: opt(iso),
  hiddenReason: opt(str),
  viewCount: z.number().default(0),
  favoriteCount: z.number().default(0),
  openReportCount: z.number().default(0),
  reviewFlags: z.array(z.enum(ListingReviewFlag)).default([]),
});
export type AdminListingListItem = z.infer<typeof adminListingListItemSchema>;
export const adminListingPageSchema = pageOf(adminListingListItemSchema);

export const listingHistoryEntrySchema = z.object({
  id: str,
  /** Audit action, e.g. LISTING_PUBLISHED · LISTING_HIDDEN (labels in lib/labels.ts; unknown → raw). */
  action: str,
  actorType: opt(z.enum(AuditActorType)),
  actorName: opt(str),
  note: opt(str),
  createdAt: iso,
});
export type ListingHistoryEntry = z.infer<typeof listingHistoryEntrySchema>;

const adminListingDetailModel = adminListingListItemSchema.extend({
  description: opt(str),
  roadAddress: opt(str),
  jibunAddress: opt(str),
  /** PRIVATE unit number — admins only, never shown on the public site. */
  ho: opt(str),
  rooms: opt(z.number()),
  baths: opt(z.number()),
  direction: opt(z.enum(Direction)),
  approvalDate: opt(str),
  parkingSpaces: opt(z.number()),
  maintenanceFeeWon: opt(z.number()),
  moveInType: opt(z.enum(MoveInType)),
  moveInDate: opt(str),
  options: z.array(z.enum(ListingOption)).default([]),
  photos: z.array(z.object({ id: str, url: str, isCover: z.boolean().default(false) })).default([]),
  agencies: z
    .array(
      z.object({
        agencyId: str,
        name: str,
        isPrimary: z.boolean().default(false),
        status: z.enum(ListingAgencyStatus).default(ListingAgencyStatus.ACTIVE),
        contactName: opt(str),
        phone: opt(str),
        joinedAt: opt(iso),
      }),
    )
    .default([]),
  verifications: z
    .array(
      z.object({
        id: str,
        method: z.enum(VerificationMethod),
        verifiedAt: iso,
        byName: opt(str),
        note: opt(str),
      }),
    )
    .default([]),
  reports: z
    .array(
      z.object({
        id: str,
        reason: z.enum(ReportReason),
        status: z.enum(ReportStatus),
        createdAt: iso,
      }),
    )
    .default([]),
  history: z.array(listingHistoryEntrySchema).default([]),
});
/**
 * Shared `AdminListingDetail` → the detail model: `agencies[].id` → `agencyId`,
 * `recentReports` → `reports`, `agencies.length` → `agencyCount`.
 */
export function normalizeListingDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const v = raw as Record<string, unknown> & {
    agencies?: (Record<string, unknown> & { id?: string; agencyId?: string })[];
    recentReports?: unknown[];
  };
  const agencies = Array.isArray(v.agencies)
    ? v.agencies.map((a) => ({ ...a, agencyId: a.agencyId ?? a.id }))
    : v.agencies;
  return {
    ...v,
    agencies,
    agencyCount: v.agencyCount ?? (Array.isArray(agencies) ? agencies.length : undefined),
    reports: v.reports ?? v.recentReports,
  };
}

export const adminListingDetailSchema = z.preprocess(
  normalizeListingDetail,
  adminListingDetailModel,
);
export type AdminListingDetail = z.infer<typeof adminListingDetailSchema>;

// ---------- reports --------------------------------------------------------------------------

const reportListingRefSchema = z.object({
  id: str,
  title: opt(str),
  assetType: opt(z.enum(AssetType)),
  status: opt(z.enum(ListingStatus)),
  ...listingPriceShape,
  complexName: opt(str),
  dong: opt(str),
  buildingName: opt(str),
  emdName: opt(str),
  supplyArea: opt(z.number()),
  exclusiveArea: opt(z.number()),
  floorClass: opt(z.enum(FloorClass)),
  floor: opt(z.number()),
  totalFloors: opt(z.number()),
  verifiedAt: opt(iso),
  publishedAt: opt(iso),
  photoCount: opt(z.number()),
  coverUrl: opt(str),
});
const reportAgencyRefSchema = z.object({
  id: str,
  name: str,
  representativeName: opt(str),
  phone: opt(str),
  status: opt(z.enum(AgencyStatus)),
  warningCount: opt(z.number()),
});

export const adminReportListItemSchema = z.object({
  id: str,
  targetType: z.enum(ReportTargetType),
  reason: z.enum(ReportReason),
  status: z.enum(ReportStatus),
  action: opt(z.enum(ReportAction)),
  detail: opt(str),
  createdAt: iso,
  handledAt: opt(iso),
  listing: opt(reportListingRefSchema),
  agency: opt(reportAgencyRefSchema),
  /** Reports (any status) filed against the same target, this one included. */
  sameTargetCount: z.number().default(1),
});
export type AdminReportListItem = z.infer<typeof adminReportListItemSchema>;
export const adminReportPageSchema = pageOf(adminReportListItemSchema);

const adminReportDetailModel = adminReportListItemSchema.extend({
  reporter: opt(
    z.object({
      id: str,
      nickname: opt(str),
      /** WITHDRAWN (nickname null) = 탈퇴한 회원; a live member may have no nickname. */
      status: opt(z.enum(UserStatus)),
      /** Reports this member has filed / how many of them were upheld. */
      reportCount: opt(z.number()),
      upheldCount: opt(z.number()),
    }),
  ),
  reporterPhone: opt(str),
  /**
   * The moderators' note on the report (shared `AdminReportView.resolutionNote`): written with
   * PATCH `{ note }` while the report is open and by the resolution. Never part of the reporter /
   * office notifications (those carry the action label only).
   */
  resolutionNote: opt(str),
  /** Same text as `resolutionNote` (the memo panel reads it); the API has one note per report. */
  internalNote: opt(str),
  handledByName: opt(str),
  /** Evidence images attached by the reporter (optional — not in reportCreateSchema yet). */
  attachments: z.array(z.object({ id: str, url: str, fileName: opt(str) })).default([]),
  relatedReports: z
    .array(
      z.object({
        id: str,
        reason: z.enum(ReportReason),
        status: z.enum(ReportStatus),
        action: opt(z.enum(ReportAction)),
        createdAt: iso,
      }),
    )
    .default([]),
  /** Status changes + memo edits, newest first. */
  timeline: z
    .array(
      z.object({
        id: str,
        status: opt(z.enum(ReportStatus)),
        note: opt(str),
        adminName: opt(str),
        createdAt: iso,
      }),
    )
    .default([]),
});
/**
 * Shared `AdminReportView` (GET/PATCH /admin/reports/:id, resolve) → the detail model:
 * `handledBy.name` → `handledByName`, the memo = `resolutionNote`.
 */
export function normalizeReportDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const v = raw as Record<string, unknown> & { handledBy?: { name?: string } | null };
  return {
    ...v,
    handledByName: v.handledByName ?? v.handledBy?.name ?? null,
    internalNote: v.internalNote ?? v.resolutionNote ?? null,
  };
}

export const adminReportDetailSchema = z.preprocess(normalizeReportDetail, adminReportDetailModel);
export type AdminReportDetail = z.infer<typeof adminReportDetailSchema>;

// ---------- deal requests --------------------------------------------------------------------

const adminDealRequestListItemModel = z.object({
  id: str,
  type: z.enum(DealRequestType),
  status: z.enum(DealRequestStatus),
  assetType: z.enum(AssetType),
  dealTypes: z.array(z.enum(DealType)).default([]),
  visibility: z.enum(DealRequestVisibility),
  /** 내놓기: the property. */
  complexName: opt(str),
  emdName: opt(str),
  exclusiveArea: opt(z.number()),
  desiredSalePrice: opt(z.number()),
  desiredDeposit: opt(z.number()),
  desiredMonthlyRent: opt(z.number()),
  /** 구하기: wanted regions / ranges. */
  regionNames: z.array(str).default([]),
  priceMin: opt(z.number()),
  priceMax: opt(z.number()),
  depositMin: opt(z.number()),
  depositMax: opt(z.number()),
  rentMin: opt(z.number()),
  rentMax: opt(z.number()),
  areaMin: opt(z.number()),
  areaMax: opt(z.number()),
  targetAgencyCount: z.number().default(0),
  proposalCount: z.number().default(0),
  /**
   * The requesting member (API `requester`). `status: WITHDRAWN` (nickname null) or a missing
   * requester = 탈퇴한 회원; a live member may have no nickname (Google sign-ups).
   */
  requester: opt(
    z.object({
      id: str,
      nickname: opt(str),
      status: opt(z.enum(UserStatus)),
      createdAt: opt(iso),
      dealRequestCount: opt(z.number()),
    }),
  ),
  contactName: opt(str),
  /** Set while the request is flagged as spam (hidden from agencies). */
  spamFlaggedAt: opt(iso),
  /** Number of automatic abuse signals (> 0 and not flagged = 스팸 의심). */
  spamSignalCount: z.number().default(0),
  createdAt: iso,
  expiresAt: opt(iso),
  closedAt: opt(iso),
});
/**
 * Shared `AdminDealRequestView` / `AdminDealRequestDetailView` → the moderation model:
 * `complex.name` → `complexName`, `targetAgencyIds` → `targetAgencyCount`, masked contact →
 * `contactName` / `contactPhone`. `requester` comes from the API; an older response with only
 * `userId` keeps the id and leaves the status unknown (never read as withdrawn).
 */
export function normalizeDealRequest(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !('userId' in raw)) return raw;
  const v = raw as Record<string, unknown> & {
    userId?: string;
    complex?: { name?: string } | null;
    targetAgencyIds?: string[];
    contactNameMasked?: string;
    contactPhoneMasked?: string;
  };
  return {
    ...v,
    complexName: v.complexName ?? v.complex?.name ?? null,
    targetAgencyCount: v.targetAgencyCount ?? v.targetAgencyIds?.length ?? 0,
    contactName: v.contactName ?? v.contactNameMasked ?? null,
    contactPhone: v.contactPhone ?? v.contactPhoneMasked ?? null,
    requester: v.requester ?? (v.userId ? { id: v.userId } : null),
  };
}

export const adminDealRequestListItemSchema = z.preprocess(
  normalizeDealRequest,
  adminDealRequestListItemModel,
);
export type AdminDealRequestListItem = z.infer<typeof adminDealRequestListItemSchema>;
export const adminDealRequestPageSchema = pageOf(adminDealRequestListItemSchema);

const adminDealRequestDetailModel = adminDealRequestListItemModel.extend({
  contactPhone: opt(str),
  description: opt(str),
  roadAddress: opt(str),
  addressDetail: opt(str),
  floor: opt(z.number()),
  roomsMin: opt(z.number()),
  moveInDate: opt(str),
  spamReason: opt(str),
  /** Automatic abuse signals, human readable ("24시간 내 같은 연락처로 4건 등록"). */
  spamSignals: z.array(str).default([]),
  closeReason: opt(str),
  targets: z.array(z.object({ agencyId: str, name: str })).default([]),
  proposals: z
    .array(
      z.object({
        id: str,
        agencyId: str,
        agencyName: str,
        status: z.enum(ProposalStatus),
        message: opt(str),
        listingCount: opt(z.number()),
        createdAt: iso,
      }),
    )
    .default([]),
  contactGrants: z.array(z.object({ agencyId: str, agencyName: str, grantedAt: iso })).default([]),
  history: z
    .array(
      z.object({
        id: str,
        action: str,
        actorName: opt(str),
        note: opt(str),
        createdAt: iso,
      }),
    )
    .default([]),
});
export const adminDealRequestDetailSchema = z.preprocess(
  normalizeDealRequest,
  adminDealRequestDetailModel,
);
export type AdminDealRequestDetail = z.infer<typeof adminDealRequestDetailSchema>;

// ---------- users ----------------------------------------------------------------------------

export const adminUserListItemSchema = z.object({
  id: str,
  name: opt(str),
  nickname: opt(str),
  email: opt(str),
  phone: opt(str),
  role: z.enum(UserRole),
  status: z.enum(UserStatus),
  providers: z.array(z.enum(AuthProvider)).default([]),
  agency: opt(z.object({ id: str, name: str })),
  createdAt: iso,
  lastLoginAt: opt(iso),
  suspendedAt: opt(iso),
  withdrawnAt: opt(iso),
});
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;
export const adminUserPageSchema = pageOf(adminUserListItemSchema);

const adminUserDetailModel = adminUserListItemSchema.extend({
  marketingOptIn: z.boolean().default(false),
  suspendedReason: opt(str),
  withdrawalReason: opt(str),
  piiScrubAfter: opt(iso),
  piiScrubbedAt: opt(iso),
  identities: z
    .array(
      z.object({
        id: str,
        provider: z.enum(AuthProvider),
        email: opt(str),
        emailVerified: z.boolean().default(false),
        lastUsedAt: opt(iso),
        createdAt: iso,
      }),
    )
    .default([]),
  consents: z
    .array(
      z.object({
        id: str,
        termsType: z.enum(TermsType),
        termsTitle: opt(str),
        version: str,
        isRequired: z.boolean().default(false),
        agreed: z.boolean(),
        createdAt: iso,
      }),
    )
    .default([]),
  agency: opt(
    z.object({
      id: str,
      name: str,
      status: opt(z.enum(AgencyStatus)),
      memberRole: opt(z.enum(AgencyMemberRole)),
    }),
  ),
  activity: opt(
    z.object({
      dealRequestCount: z.number().default(0),
      reportCount: z.number().default(0),
      favoriteCount: z.number().default(0),
      activeSessionCount: z.number().default(0),
    }),
  ),
  sanctions: z
    .array(
      z.object({
        id: str,
        action: z.enum(['SUSPENDED', 'UNSUSPENDED']),
        reason: opt(str),
        adminName: opt(str),
        createdAt: iso,
      }),
    )
    .default([]),
});
/**
 * Shared `MemberDetail` (GET /admin/users/:id, suspend / unsuspend) → the detail model: identities
 * get an id (their provider), `memberships[0]` → `agency`, `counts` + `activeSessions` →
 * `activity`, providers from the identities.
 */
export function normalizeUserDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !('counts' in raw || 'memberships' in raw)) return raw;
  const v = raw as Record<string, unknown> & {
    identities?: (Record<string, unknown> & { provider?: string; id?: string })[];
    memberships?: {
      agencyId: string;
      agencyName: string;
      agencyStatus?: string;
      role?: string;
    }[];
    counts?: { dealRequests?: number; reports?: number; favoriteListings?: number };
    activeSessions?: number;
    providers?: string[];
  };
  const identities = (v.identities ?? []).map((i) => ({ ...i, id: i.id ?? i.provider }));
  const m = v.memberships?.[0];
  return {
    ...v,
    identities,
    providers: v.providers ?? identities.map((i) => i.provider),
    agency: m
      ? { id: m.agencyId, name: m.agencyName, status: m.agencyStatus, memberRole: m.role }
      : (v.agency ?? null),
    activity: v.counts
      ? {
          dealRequestCount: v.counts.dealRequests ?? 0,
          reportCount: v.counts.reports ?? 0,
          favoriteCount: v.counts.favoriteListings ?? 0,
          activeSessionCount: v.activeSessions ?? 0,
        }
      : v.activity,
  };
}

export const adminUserDetailSchema = z.preprocess(normalizeUserDetail, adminUserDetailModel);
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
