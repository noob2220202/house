// Owned by the listings module team. Response shapes of the listings API (dates are ISO strings,
// money is 만원 except 관리비 in 원, areas are ㎡ with 평 for display).
import type { Paginated } from '../schemas/common';
import type { MapResultKind } from '../constants/map';
import type { MaintenanceFee } from '../schemas/listings';
import type {
  AssetType,
  BuildingUse,
  DealType,
  Direction,
  DirectionBasis,
  FloorClass,
  FloorDisplay,
  ListingAgencyStatus,
  ListingOption,
  ListingStatus,
  MoveInType,
  RecentViewTarget,
  VerificationMethod,
} from '../enums/listing';

export interface PhotoUrls {
  mediaId: string;
  thumbUrl: string;
  mediumUrl: string;
  largeUrl: string;
  caption: string | null;
  isCover: boolean;
}

export interface ListingPriceView {
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  /** 매매가 / 분양가+프리미엄 / 보증금 (만원). */
  priceSort: number | null;
}

export interface ListingSummary extends ListingPriceView {
  id: string;
  dealType: DealType;
  assetType: AssetType;
  status: ListingStatus;
  title: string | null;
  maintenanceFeeWon: number | null;
  exclusiveArea: number | null;
  exclusiveAreaPyeong: number | null;
  supplyArea: number | null;
  floorLabel: string | null;
  floorClass: FloorClass | null;
  rooms: number | null;
  baths: number | null;
  direction: Direction | null;
  builtYear: number | null;
  roadAddress: string;
  buildingName: string | null;
  dong: string | null;
  emdCode: string | null;
  lat: number;
  lng: number;
  complex: { id: string; name: string } | null;
  coverPhoto: PhotoUrls | null;
  photoCount: number;
  options: ListingOption[];
  verifiedAt: string | null;
  publishedAt: string | null;
  primaryAgency: { id: string; name: string };
  agencyCount: number;
  viewCount: number;
  favoriteCount: number;
}

/** 표시·광고 명시사항 of a responsible agency, shown with every public listing. */
export interface ListingAgencyDisclosure {
  agencyId: string;
  isPrimary: boolean;
  /** 중개사무소 명칭 */
  name: string;
  /** 중개사무소 소재지 */
  roadAddress: string;
  addressDetail: string | null;
  /** 연락처 */
  phone: string;
  /** 등록번호 */
  registrationNumber: string;
  /** 개업공인중개사 성명 */
  representativeName: string;
  contactName: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
}

export interface ListingDetail extends ListingSummary {
  description: string | null;
  /** 관리비 부과방식 + 항목별 내역 (null = not entered; maintenanceFeeWon 0 = 없음). */
  maintenanceFee: MaintenanceFee | null;
  moveInType: MoveInType | null;
  moveInDate: string | null;
  floorDisplay: FloorDisplay;
  property: {
    assetType: AssetType;
    roadAddress: string;
    jibunAddress: string | null;
    buildingName: string | null;
    dong: string | null;
    /** Exact floor only when floorDisplay = EXACT (null otherwise). */
    floor: number | null;
    totalFloors: number | null;
    exclusiveArea: number | null;
    supplyArea: number | null;
    landArea: number | null;
    totalFloorArea: number | null;
    rooms: number | null;
    baths: number | null;
    direction: Direction | null;
    directionBasis: DirectionBasis | null;
    approvalDate: string | null;
    parkingSpaces: number | null;
    heatingType: string | null;
    zoning: string | null;
    landCategory: string | null;
    /** 건축물 용도 (중개대상물 종류); implied for 아파트/오피스텔 when not stated. */
    buildingUse: BuildingUse | null;
  };
  complex: { id: string; name: string; households: number | null; builtYear: number | null } | null;
  photos: PhotoUrls[];
  agencies: ListingAgencyDisclosure[];
  latestVerification: { method: VerificationMethod; verifiedAt: string } | null;
  isFavorite: boolean;
}

/** Agency-side view: includes PRIVATE fields (호, private note) and co-broker bookkeeping. */
export interface AgencyListingDetail extends Omit<ListingDetail, 'agencies' | 'property'> {
  property: ListingDetail['property'] & {
    id: string;
    /** 호 — only the primary agency sees it (null for co-brokers). */
    ho: string | null;
    emdCode: string | null;
    complexId: string | null;
    areaTypeId: string | null;
  };
  /** Primary agency only (null for co-brokers). */
  hiddenReason: string | null;
  closedAt: string | null;
  /** End of the current ad period (ACTIVE/RESERVED listings revert to DRAFT after it). */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Send back as `version` on PATCH to detect concurrent edits. */
  version: number;
  isPrimaryAgency: boolean;
  /** The primary sees every row (incl. PENDING requests); co-brokers see ACTIVE rows + their own. */
  agencies: (ListingAgencyDisclosure & {
    status: ListingAgencyStatus;
    /** Only on the caller's own row (null on other agencies' rows). */
    contactMemberId: string | null;
    joinedAt: string;
  })[];
  verifications: {
    id: string;
    method: VerificationMethod;
    verifiedAt: string;
    note: string | null;
    byAdmin: boolean;
  }[];
}

export interface DealTypeStats {
  count: number;
  /** min/max of priceSort (만원). */
  priceMin: number | null;
  priceMax: number | null;
  /** 월세 only. */
  rentMin?: number | null;
  rentMax?: number | null;
}
export type DealTypeStatsMap = Partial<Record<DealType, DealTypeStats>>;

export interface MapCluster {
  /** Region code (REGION_CLUSTERS) or "lng:lat" of the grid cell (GRID_CLUSTERS). */
  key: string;
  regionCode: string | null;
  name: string | null;
  lat: number;
  lng: number;
  count: number;
  byDealType: DealTypeStatsMap;
}

export interface MapComplexMarker {
  complexId: string;
  name: string;
  assetType: AssetType;
  lat: number;
  lng: number;
  households: number | null;
  builtYear: number | null;
  count: number;
  byDealType: DealTypeStatsMap;
}

export interface MapListingMarker extends ListingPriceView {
  id: string;
  dealType: DealType;
  assetType: AssetType;
  lat: number;
  lng: number;
  exclusiveArea: number | null;
  floorClass: FloorClass | null;
  rooms: number | null;
}

export interface MapSearchResult {
  kind: MapResultKind;
  zoom: number;
  /** Tile-aligned area actually searched (covers the requested bbox). */
  bbox: { swLng: number; swLat: number; neLng: number; neLat: number };
  total: number;
  clusters: MapCluster[];
  complexes: MapComplexMarker[];
  listings: MapListingMarker[];
  /** true when markers were capped at MAP_MAX_MARKERS. */
  truncated: boolean;
}

export type ListingPage = Paginated<ListingSummary>;

export interface FavoriteListingItem {
  favoritedAt: string;
  listing: ListingSummary;
}

export interface RecentViewItem {
  targetType: RecentViewTarget;
  targetId: string;
  viewedAt: string;
  listing?: ListingSummary;
  complex?: { id: string; name: string; roadAddress: string | null };
  agency?: { id: string; name: string; roadAddress: string };
}

/** Result of POST /agency/listings/:id/co-brokers: a request the primary agency must accept. */
export interface CoBrokerRequestResult {
  listingId: string;
  agencyId: string;
  status: ListingAgencyStatus;
  requestedAt: string;
}
