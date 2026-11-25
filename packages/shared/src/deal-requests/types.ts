// Owned by the deal-requests module team. Response shapes of the deal-requests API.
import type { AgencyDisclosure } from '../agencies/disclosure';
import type {
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  ProposalStatus,
} from '../enums/deal-request';
import type { AssetType, DealType, ListingStatus } from '../enums/listing';
import type { NotificationType, UserStatus } from '../enums/user';
import type { DealRequestAreaRange } from './public-view';

export interface DealRequestPhotoView {
  mediaId: string;
  url: string;
  thumbUrl: string;
}

export interface DealRequestComplexRef {
  id: string;
  name: string;
}

/**
 * Fields every viewer of a request may see. Never contains the contact, 동·호 or requester identity:
 * those are added per audience (owner / granted agency / admin).
 */
export interface DealRequestBaseView {
  id: string;
  type: DealRequestType;
  status: DealRequestStatus;
  assetType: AssetType;
  dealTypes: DealType[];
  visibility: DealRequestVisibility;
  sggCode: string;
  emdCode: string | null;
  // 내놓기
  roadAddress: string | null;
  complex: DealRequestComplexRef | null;
  lat: number | null;
  lng: number | null;
  exclusiveArea: number | null;
  floor: number | null;
  desiredSalePrice: number | null;
  desiredDeposit: number | null;
  desiredMonthlyRent: number | null;
  // 구하기
  regionCodes: string[];
  complexIds: string[];
  priceMin: number | null;
  priceMax: number | null;
  depositMin: number | null;
  depositMax: number | null;
  rentMin: number | null;
  rentMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  roomsMin: number | null;
  moveInDate: string | null;
  description: string | null;
  photos: DealRequestPhotoView[];
  proposalCount: number;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface ContactGrantView {
  agencyId: string;
  agencyName: string | null;
  grantedAt: string;
}

/** The requester's own view. */
export interface MyDealRequestView extends DealRequestBaseView {
  contactName: string;
  contactPhone: string;
  addressDetail: string | null;
  targetAgencyIds: string[];
  closeReason: string | null;
  /** Extensions used so far (max DEAL_REQUEST_LIMITS.MAX_EXTENSIONS). */
  extensionCount: number;
  contactGrants: ContactGrantView[];
}

export interface ProposalListingView {
  id: string;
  title: string | null;
  assetType: AssetType;
  dealType: DealType;
  status: ListingStatus;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  exclusiveArea: number | null;
}

/** The member who sent a proposal, as the requester sees them. */
export interface ProposalAgentView {
  displayName: string;
  /**
   * A 중개보조원 (neither the office's 대표 nor a 소속공인중개사): the UI must say so next to the
   * name (공인중개사법 제18조의4), and contact goes to the office number.
   */
  isAssistant: boolean;
  /** The member's own number for a 공인중개사; always null for a 중개보조원. */
  phone: string | null;
}

/** A proposal as the requester sees it, with the agency's 표시·광고 명시사항. */
export interface ProposalView {
  id: string;
  dealRequestId: string;
  status: ProposalStatus;
  message: string;
  suggestedPrice: number | null;
  suggestedDeposit: number | null;
  suggestedMonthlyRent: number | null;
  agencyId: string;
  agency: AgencyDisclosure | null;
  agent: ProposalAgentView | null;
  listings: ProposalListingView[];
  contactShared: boolean;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface MyDealRequestDetail extends MyDealRequestView {
  proposals: ProposalView[];
}

/** Revealed to an agency only while the requester's contact grant for it is active. */
export interface DealRequestContactView {
  name: string;
  phone: string;
  addressDetail: string | null;
}

export interface AgencyProposalRef {
  id: string;
  status: ProposalStatus;
  createdAt: string;
}

/**
 * What an agency sees in its inbox / detail. Until the requester shares contact + details with this
 * agency (`detailsShared`), a 내놓기 request is the reduced view of the DEAL_REQUEST_PROVIDE
 * notice: `roadAddress`, `floor`, `exclusiveArea` and `photos` are empty, `lat`/`lng` are the
 * centre of a DEAL_REQUEST_LOCATION_GRID_DEG cell, `areaRange` gives the area band and
 * `description` keeps only the form's flag lines (`publicDealRequestDescription`).
 */
export interface AgencyDealRequestView extends DealRequestBaseView {
  /** The requester selected this agency. */
  targeted: boolean;
  myProposal: AgencyProposalRef | null;
  contact: DealRequestContactView | null;
  /** True while this agency holds an active grant: contact and full details are included. */
  detailsShared: boolean;
  /** 내놓기: band of the exclusive area (also after a grant); null without an area / for 구하기. */
  areaRange: DealRequestAreaRange | null;
  /** 내놓기: number of photos (the photos themselves only after a grant). */
  photoCount: number;
}

/** A proposal as the sending agency sees it. */
export interface AgencyProposalView {
  id: string;
  dealRequestId: string;
  status: ProposalStatus;
  message: string;
  suggestedPrice: number | null;
  suggestedDeposit: number | null;
  suggestedMonthlyRent: number | null;
  listingIds: string[];
  memberId: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  dealRequest: {
    type: DealRequestType;
    status: DealRequestStatus;
    assetType: AssetType;
    dealTypes: DealType[];
  };
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationReadResult {
  updated: number;
  unread: number;
}

/**
 * The requesting member as admins see it. A withdrawn member (or one whose PII was scrubbed) is
 * `status: WITHDRAWN` with `nickname: null`; a live member may also have no nickname (social
 * sign-ups such as Google), which must not be read as "withdrawn".
 */
export interface AdminDealRequestRequesterView {
  id: string;
  nickname: string | null;
  status: UserStatus;
  createdAt: string;
  /** Requests this member has registered (deleted ones included). */
  dealRequestCount: number;
}

export interface AdminDealRequestAgencyRef {
  agencyId: string;
  name: string;
}

export interface AdminDealRequestProposalRef {
  id: string;
  agencyId: string;
  agencyName: string;
  status: ProposalStatus;
  message: string | null;
  listingCount: number;
  createdAt: string;
}

export interface AdminDealRequestGrantRef {
  agencyId: string;
  agencyName: string;
  grantedAt: string;
}

/** Admin moderation view: requester id and a masked phone, never the full contact. */
export interface AdminDealRequestView extends DealRequestBaseView {
  userId: string;
  /** Null only when the member row no longer exists. */
  requester: AdminDealRequestRequesterView | null;
  /** 내놓기: 법정동 name of `emdCode` (null when unknown). */
  emdName: string | null;
  /** 구하기: names of `regionCodes` that resolve, in order. */
  regionNames: string[];
  contactNameMasked: string;
  contactPhoneMasked: string;
  targetAgencyIds: string[];
  closeReason: string | null;
  contactScrubbedAt: string | null;
  deletedAt: string | null;
}

/**
 * One line of an admin request history. `action` is one of DEAL_REQUEST_CREATED, PROPOSAL_SENT,
 * CONTACT_GRANTED, DEAL_REQUEST_CLOSED, DEAL_REQUEST_SPAM_FLAGGED, DEAL_REQUEST_SPAM_CLEARED,
 * DEAL_REQUEST_CANCELLED, DEAL_REQUEST_MATCHED, DEAL_REQUEST_EXPIRED, DEAL_REQUEST_COMPLETED
 * (closed by the requester).
 */
export interface AdminDealRequestHistoryEntry {
  id: string;
  action: string;
  /** Office or admin name; null for the requester / the system. */
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

/** GET /admin/deal-requests/:id: the list view + offices, proposals, grants and history. */
export interface AdminDealRequestDetailView extends AdminDealRequestView {
  targets: AdminDealRequestAgencyRef[];
  proposals: AdminDealRequestProposalRef[];
  /** Active (unrevoked) grants. */
  contactGrants: AdminDealRequestGrantRef[];
  /** Newest first. */
  history: AdminDealRequestHistoryEntry[];
}
