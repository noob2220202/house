// Owned by the deal-requests module team. Response shapes of the deal-requests API.
import type { AgencyDisclosure } from '../agencies/disclosure';
import type {
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  ProposalStatus,
} from '../enums/deal-request';
import type { AssetType, DealType, ListingStatus } from '../enums/listing';
import type { NotificationType } from '../enums/user';

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

export interface ProposalAgentView {
  displayName: string;
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

/** What an agency sees in its inbox / detail. */
export interface AgencyDealRequestView extends DealRequestBaseView {
  /** The requester selected this agency. */
  targeted: boolean;
  myProposal: AgencyProposalRef | null;
  contact: DealRequestContactView | null;
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

/** Admin moderation view: requester id and a masked phone, never the full contact. */
export interface AdminDealRequestView extends DealRequestBaseView {
  userId: string;
  contactNameMasked: string;
  contactPhoneMasked: string;
  targetAgencyIds: string[];
  closeReason: string | null;
  contactScrubbedAt: string | null;
  deletedAt: string | null;
}
