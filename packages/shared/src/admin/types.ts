// Owned by the admin module team. Response shapes of the admin / content APIs.
import type { AdminPermission } from './permissions';
import type {
  AuditActorType,
  FaqCategory,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SiteSettingKey,
} from '../enums/admin';
import type { AgencyMemberRole, AgencyMemberStatus, AgencyStatus } from '../enums/agency';
import type {
  AssetType,
  DealType,
  Direction,
  FloorClass,
  ListingAgencyStatus,
  ListingOption,
  ListingStatus,
  MoveInType,
  VerificationMethod,
} from '../enums/listing';
import type {
  AdminRole,
  AdminStatus,
  AuthProvider,
  TermsType,
  UserRole,
  UserStatus,
} from '../enums/user';

export interface AdminPermissionsResponse {
  adminId: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

// ---------- admin accounts ----------

export interface AdminAccountView {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  totpEnabled: boolean;
  ipAllowlist: string[];
  locked: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- members ----------

export interface MemberListItem {
  id: string;
  nickname: string | null;
  name: string | null;
  /** masked in lists */
  email: string | null;
  /** masked in lists */
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  providers: AuthProvider[];
  /** The member's current agency (latest ACTIVE membership), null for a plain member. */
  agency: { id: string; name: string } | null;
  createdAt: string;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  withdrawnAt: string | null;
}

/**
 * GET /admin/users/:id returns email/phone unmasked (and logs a `member.pii-view` audit row);
 * the suspend/unsuspend responses return them masked like the list.
 */
export interface MemberDetail extends Omit<MemberListItem, 'providers' | 'agency'> {
  marketingOptIn: boolean;
  suspendedReason: string | null;
  withdrawalReason: string | null;
  /** When the withdrawal PII scrub runs (null until withdrawal). */
  piiScrubAfter: string | null;
  piiScrubbedAt: string | null;
  /** `email` is what the provider gave (masked in the suspend/unsuspend responses). */
  identities: {
    id: string;
    provider: AuthProvider;
    email: string | null;
    emailVerified: boolean;
    createdAt: string;
    lastUsedAt: string | null;
  }[];
  /** Terms agreements, newest first (most recent 100). */
  consents: MemberConsentView[];
  /** Suspensions / lifts from the audit log, newest first. */
  sanctions: MemberSanctionView[];
  memberships: {
    agencyId: string;
    agencyName: string;
    agencyStatus: AgencyStatus;
    role: AgencyMemberRole;
    status: AgencyMemberStatus;
  }[];
  counts: { dealRequests: number; reports: number; favoriteListings: number };
  /** Live login sessions (devices). */
  activeSessions: number;
}

export interface MemberConsentView {
  id: string;
  termsType: TermsType;
  termsTitle: string;
  version: string;
  isRequired: boolean;
  agreed: boolean;
  createdAt: string;
}

export interface MemberSanctionView {
  id: string;
  action: 'SUSPENDED' | 'UNSUSPENDED';
  reason: string | null;
  adminName: string | null;
  createdAt: string;
}

// ---------- listings ----------

/**
 * Why a listing is in the admin 검수 필요 queue: open reports, or advertised (ACTIVE / RESERVED)
 * without a 실매물 확인.
 */
export type AdminListingReviewFlag = 'REPORTED' | 'UNVERIFIED';

export interface AdminListingListItem {
  id: string;
  status: ListingStatus;
  dealType: DealType;
  assetType: AssetType;
  title: string | null;
  roadAddress: string;
  complexId: string | null;
  complexName: string | null;
  buildingName: string | null;
  dong: string | null;
  /** 법정동 name of the listing (null when unknown). */
  emdName: string | null;
  supplyArea: number | null;
  exclusiveArea: number | null;
  floorClass: FloorClass | null;
  floor: number | null;
  totalFloors: number | null;
  primaryAgency: { id: string; name: string };
  /** ACTIVE offices on the listing (primary included). */
  agencyCount: number;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  photoCount: number;
  coverUrl: string | null;
  verifiedAt: string | null;
  hiddenReason: string | null;
  openReportCount: number;
  viewCount: number;
  favoriteCount: number;
  reviewFlags: AdminListingReviewFlag[];
  publishedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminListingDetail extends AdminListingListItem {
  description: string | null;
  jibunAddress: string | null;
  rooms: number | null;
  baths: number | null;
  direction: Direction | null;
  approvalDate: string | null;
  parkingSpaces: number | null;
  maintenanceFeeWon: number | null;
  moveInType: MoveInType | null;
  moveInDate: string | null;
  options: ListingOption[];
  photos: { id: string; url: string; isCover: boolean }[];
  agencies: {
    id: string;
    name: string;
    isPrimary: boolean;
    status: ListingAgencyStatus;
    contactName: string | null;
    phone: string | null;
    joinedAt: string;
  }[];
  verifications: {
    id: string;
    method: VerificationMethod;
    verifiedAt: string;
    byName: string | null;
    note: string | null;
  }[];
  recentReports: {
    id: string;
    reason: ReportReason;
    status: ReportStatus;
    createdAt: string;
  }[];
  /** Newest first: lifecycle timestamps, co-brokers, verifications, reports and admin actions. */
  history: {
    id: string;
    action: string;
    actorType: AuditActorType | null;
    actorName: string | null;
    note: string | null;
    createdAt: string;
  }[];
}

// ---------- reports ----------

export interface ReportCreatedResponse {
  id: string;
  status: ReportStatus;
  createdAt: string;
}

export interface AdminReportView {
  id: string;
  targetType: ReportTargetType;
  /**
   * The reported listing as it is now: what the moderator needs to judge the report (종류, 거래
   * 형태·가격, 단지·동, 면적·층, 실매물 확인, 광고 시작) without opening the listing.
   */
  listing: {
    id: string;
    status: ListingStatus;
    title: string | null;
    roadAddress: string;
    assetType: AssetType;
    dealType: DealType;
    /** 만원 */
    salePrice: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    presalePrice: number | null;
    premium: number | null;
    complexName: string | null;
    dong: string | null;
    buildingName: string | null;
    exclusiveArea: number | null;
    supplyArea: number | null;
    floorClass: FloorClass | null;
    floor: number | null;
    totalFloors: number | null;
    verifiedAt: string | null;
    publishedAt: string | null;
    photoCount: number;
  } | null;
  agency: { id: string; name: string; status: AgencyStatus; warningCount: number } | null;
  /**
   * The reporting member (null for an anonymous report). A withdrawn member reads
   * `status: WITHDRAWN` with no nickname; a live member may have no nickname.
   */
  reporter: {
    id: string;
    nickname: string | null;
    status: UserStatus;
    /** Reports this member has filed / how many were upheld (RESOLVED with an action). */
    reportCount: number;
    upheldCount: number;
  } | null;
  /** Reports (any status) against the same listing / agency, this one included. */
  sameTargetCount: number;
  /**
   * Callback number typed by the reporter. Masked (010-****-5678) everywhere except
   * GET /admin/reports/:id, which returns it in full and records a `report.pii-view` audit row.
   */
  reporterPhone: string | null;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  action: ReportAction | null;
  resolutionNote: string | null;
  handledBy: { id: string; name: string } | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/reports/:id and the PATCH / resolve responses. */
export interface AdminReportDetailView extends AdminReportView {
  /** Other reports against the same target, newest first (up to 10). */
  relatedReports: {
    id: string;
    reason: ReportReason;
    status: ReportStatus;
    action: ReportAction | null;
    createdAt: string;
  }[];
  /** 접수, status changes and note edits, newest first. */
  timeline: {
    id: string;
    status: ReportStatus | null;
    note: string | null;
    adminName: string | null;
    createdAt: string;
  }[];
}

// ---------- content ----------

export interface NoticeListItem {
  id: string;
  title: string;
  isPinned: boolean;
  publishedAt: string | null;
  viewCount: number;
}

export interface NoticeView extends NoticeListItem {
  content: string;
}

export interface AdminNoticeView extends NoticeView {
  isPublished: boolean;
  /** Author's name (null once the admin account is deleted). */
  createdByAdminName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FaqView {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface AdminFaqView extends FaqView {
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalVideoView {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  description: string | null;
  regionCode: string | null;
  complexId: string | null;
  sortOrder: number;
  publishedAt: string | null;
}

export interface AdminLocalVideoView extends LocalVideoView {
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTermsView {
  id: string;
  type: TermsType;
  version: string;
  title: string;
  content: string;
  isRequired: boolean;
  effectiveAt: string;
  publishedAt: string | null;
  /** Published + effective + latest of its type: what users see and consent to now. */
  isCurrent: boolean;
  /**
   * Published, required and the newest version of its type: once effective, users who agreed only
   * to an older version are asked to agree again (auth `/auth/me.pendingRequiredTerms`).
   */
  requiresReconsent: boolean;
  consentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettingView {
  key: SiteSettingKey;
  value: unknown;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

export type PublicSiteSettings = Partial<Record<SiteSettingKey, unknown>>;

// ---------- dashboard ----------

export interface AdminDashboard {
  generatedAt: string;
  visitors: {
    today: number;
    yesterday: number;
    /** oldest first, KST days "YYYY-MM-DD" */
    last7Days: { date: string; count: number }[];
    uniqueLast7Days: number;
  };
  listings: { newToday: number; active: number; hidden: number };
  dealRequests: { newToday: number; open: number };
  agencies: { pending: number; approved: number };
  reports: { open: number; newToday: number };
  members: { newToday: number; total: number; suspended: number };
  ads: {
    /** Banners live now that end within ADS_ENDING_SOON_DAYS. */
    endingSoon: { id: string; title: string; slot: string; endAt: string }[];
    endingSoonCount: number;
  };
}

// ---------- audit log ----------

export interface AuditLogView {
  id: string;
  actorType: AuditActorType;
  admin: { id: string; name: string; email: string } | null;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}
