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
import type { AssetType, DealType, ListingStatus } from '../enums/listing';
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
  createdAt: string;
  lastLoginAt: string | null;
}

export interface MemberDetail extends Omit<MemberListItem, 'providers'> {
  marketingOptIn: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  piiScrubbedAt: string | null;
  identities: { provider: AuthProvider; createdAt: string; lastUsedAt: string | null }[];
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

// ---------- listings ----------

export interface AdminListingListItem {
  id: string;
  status: ListingStatus;
  dealType: DealType;
  assetType: AssetType;
  title: string | null;
  roadAddress: string;
  complexId: string | null;
  primaryAgency: { id: string; name: string };
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  hiddenReason: string | null;
  openReportCount: number;
  viewCount: number;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminListingDetail extends AdminListingListItem {
  description: string | null;
  verifiedAt: string | null;
  photoCount: number;
  agencies: { id: string; name: string; isPrimary: boolean }[];
  recentReports: {
    id: string;
    reason: ReportReason;
    status: ReportStatus;
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
  listing: {
    id: string;
    status: ListingStatus;
    title: string | null;
    roadAddress: string;
  } | null;
  agency: { id: string; name: string; status: AgencyStatus; warningCount: number } | null;
  reporter: { id: string; nickname: string | null } | null;
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
