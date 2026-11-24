// Owned by the agencies module team. Response shapes of the agencies API.
import type {
  AgencyDocumentType,
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
} from '../enums/agency';
import type { AssetType, DealType } from '../enums/listing';
import type { MapResultKind } from '../constants/map';
import type { AgencyDisclosure } from './disclosure';
import type { BusinessHours } from './hours';

export interface AgencySummary {
  id: string;
  name: string;
  representativeName: string;
  registrationNumber: string;
  phone: string;
  roadAddress: string;
  addressDetail: string | null;
  emdCode: string | null;
  lat: number;
  lng: number;
  specialties: AssetType[];
  logoUrl: string | null;
  activeListingCount: number;
}

/**
 * Row of GET /agencies (office search): the summary plus what the result card shows — 영업시간
 * (the client renders 영업 중 from it) and whether the office handles 분양권.
 */
export interface AgencySearchItem extends AgencySummary {
  businessHours: BusinessHours | null;
  /** Advertises at least one public 분양권 listing (own or co-brokered). */
  handlesPresale: boolean;
}

export interface AgencyPublicMember {
  id: string;
  displayName: string;
  title: string | null;
  role: AgencyMemberRole;
  isLicensed: boolean;
}

export interface AgencyListingCounts {
  total: number;
  byAssetType: Partial<Record<AssetType, number>>;
  byDealType: Partial<Record<DealType, number>>;
}

/** Compact listing card shown on the agency profile (대표 매물). Never contains 동/호. */
export interface AgencyListingCard {
  id: string;
  assetType: AssetType;
  dealType: DealType;
  title: string | null;
  complexName: string | null;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  exclusiveArea: number | null;
  rooms: number | null;
  thumbnailUrl: string | null;
  verifiedAt: string | null;
  publishedAt: string | null;
}

export interface AgencyProfile extends AgencySummary {
  /** Public URL of the cover image (large variant); null when none is set. */
  coverUrl: string | null;
  mobile: string | null;
  email: string | null;
  jibunAddress: string | null;
  intro: string | null;
  businessHours: BusinessHours | null;
  approvedAt: string | null;
  warningCount: number;
  members: AgencyPublicMember[];
  listingCounts: AgencyListingCounts;
  representativeListings: AgencyListingCard[];
  disclosure: AgencyDisclosure;
}

export interface AgencyDocumentView {
  id: string;
  type: AgencyDocumentType;
  mediaId: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  createdAt: string;
}

export interface AgencyStatusHistoryView {
  id: string;
  fromStatus: AgencyStatus | null;
  toStatus: AgencyStatus;
  reason: string | null;
  /** Set for admin decisions; null for the owner's own submission/resubmission. */
  decidedBy: { id: string; name: string } | null;
  createdAt: string;
}

/** GET /agencies/mine — the owner's own agency (any status). */
export interface MyAgency extends Omit<AgencySummary, 'activeListingCount'> {
  businessNumber: string | null;
  mobile: string | null;
  email: string | null;
  jibunAddress: string | null;
  zipCode: string | null;
  intro: string | null;
  businessHours: BusinessHours | null;
  logoMediaId: string | null;
  /** Cover image of the public page (purpose AGENCY_COVER) and its public URL (large variant). */
  coverMediaId: string | null;
  coverUrl: string | null;
  status: AgencyStatus;
  statusReason: string | null;
  approvedAt: string | null;
  suspendedAt: string | null;
  activeListingCount: number;
  memberCount: number;
  documents: AgencyDocumentView[];
  statusHistory: AgencyStatusHistoryView[];
  createdAt: string;
  updatedAt: string;
}

export interface AgencyMemberView {
  id: string;
  userId: string;
  role: AgencyMemberRole;
  status: AgencyMemberStatus;
  displayName: string;
  title: string | null;
  phone: string | null;
  isLicensed: boolean;
  licenseNumber: string | null;
  joinedAt: string;
  removedAt: string | null;
}

/** The caller's own membership (GET /agencies/membership). */
export interface MyAgencyMembership {
  memberId: string;
  role: AgencyMemberRole;
  displayName: string;
  agency: Pick<AgencySummary, 'id' | 'name' | 'phone' | 'roadAddress'> & { status: AgencyStatus };
}

export interface AgencyInviteView {
  id: string;
  /** Only returned once, on creation. */
  code?: string;
  /** Last 4 characters, to tell invites apart. */
  codeHint: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface AgencyRegionCluster {
  code: string;
  name: string | null;
  lat: number;
  lng: number;
  count: number;
}

export interface AgencyGridCluster {
  lat: number;
  lng: number;
  count: number;
}

export interface AgencyMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  activeListingCount: number;
  logoUrl: string | null;
}

export type AgencyMapResult =
  | { kind: typeof MapResultKind.REGION_CLUSTERS; clusters: AgencyRegionCluster[] }
  | { kind: typeof MapResultKind.GRID_CLUSTERS; clusters: AgencyGridCluster[] }
  | { kind: typeof MapResultKind.MARKERS; markers: AgencyMarker[]; truncated: boolean };

// ---------- admin ----------

export interface AdminAgencyListItem {
  id: string;
  name: string;
  representativeName: string;
  registrationNumber: string;
  phone: string;
  roadAddress: string;
  status: AgencyStatus;
  owner: { id: string; name: string | null; email: string | null };
  documentCount: number;
  memberCount: number;
  warningCount: number;
  createdAt: string;
  approvedAt: string | null;
}

export interface AdminAgencyDetail extends MyAgency {
  owner: {
    id: string;
    name: string | null;
    nickname: string | null;
    email: string | null;
    phone: string | null;
    status: string;
  };
  members: AgencyMemberView[];
  warningCount: number;
  recentWarnings: { id: string; reason: string; reportId: string | null; createdAt: string }[];
}

export const RegistryCheckStatus = {
  /** Registry record found and every compared field matches. */
  MATCH: 'MATCH',
  /** Found, but some field differs (or the office is not 영업중). */
  MISMATCH: 'MISMATCH',
  NOT_FOUND: 'NOT_FOUND',
  /** Lookup not configured or the registry did not answer. */
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type RegistryCheckStatus = (typeof RegistryCheckStatus)[keyof typeof RegistryCheckStatus];

export interface BrokerRegistryRecord {
  registrationNumber: string;
  officeName: string;
  representativeName: string | null;
  /** True when the registry says the office is operating (영업). */
  operating: boolean;
  statusLabel: string | null;
  regionName: string | null;
  registeredOn: string | null;
}

export type RegistryMismatchField = 'officeName' | 'representativeName' | 'operating';

export interface AgencyRegistryCheck {
  status: RegistryCheckStatus;
  checkedAt: string;
  record: BrokerRegistryRecord | null;
  mismatches: RegistryMismatchField[];
}
