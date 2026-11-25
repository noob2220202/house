import type { DealType, AssetType } from '../enums/listing';
import type { RegionLevel } from '../enums/region';
import type { TradeDealType, TradeSyncKind, TradeSyncStatus } from '../enums/complex';

/** Response shapes of the complexes API (/api/v1/complexes, /regions, admin). */

export interface RegionView {
  code: string;
  name: string;
  fullName: string;
  level: RegionLevel;
  parentCode: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
}

export interface ComplexAreaTypeView {
  id: string;
  /** 전용면적 ㎡ */
  exclusiveArea: number;
  /** 공급면적 ㎡ */
  supplyArea: number | null;
  exclusivePyeong: number;
  supplyPyeong: number | null;
  typeName: string;
  /** e.g. "34평" (공급 기준) or "25평" (전용 기준 when 공급면적 is unknown). */
  pyeongLabel: string;
  households: number | null;
  rooms: number | null;
  baths: number | null;
}

export interface ComplexPhotoView {
  mediaId: string;
  thumbUrl: string;
  mediumUrl: string;
  largeUrl: string;
  caption: string | null;
  sortOrder: number;
}

export interface ComplexSummary {
  id: string;
  name: string;
  assetType: AssetType;
  roadAddress: string | null;
  jibunAddress: string | null;
  sggCode: string;
  emdCode: string | null;
  emdName: string | null;
  lat: number;
  lng: number;
  households: number | null;
  buildings: number | null;
  builtYear: number | null;
  /** 사용승인일 (YYYY-MM-DD) */
  approvalDate: string | null;
  activeListingCount: number;
  favoriteCount: number;
  viewCount: number;
}

export interface DealTypeListingSummary {
  dealType: DealType;
  count: number;
  /** 만원: 매매가 / 분양가+프리미엄 / 보증금 */
  minPrice: number | null;
  maxPrice: number | null;
  /** 만원, 월세 only */
  minMonthlyRent: number | null;
  maxMonthlyRent: number | null;
}

export interface ComplexListingsSummary {
  complexId: string;
  total: number;
  byDealType: DealTypeListingSummary[];
}

export interface TradeView {
  id: string;
  dealType: TradeDealType;
  /** YYYY-MM-DD */
  dealDate: string;
  yearMonth: number;
  exclusiveArea: number;
  exclusivePyeong: number;
  areaTypeId: string | null;
  floor: number | null;
  /** 매매 거래금액 (만원) */
  price: number | null;
  /** 보증금 (만원) */
  deposit: number | null;
  /** 월세 (만원) */
  monthlyRent: number | null;
  /** 해제 (cancelled) — shown struck through, excluded from stats. */
  cancelled: boolean;
  cancelledAt: string | null;
  /** 신규 / 갱신 (전월세) */
  contractType: string | null;
}

export interface ComplexDetail extends ComplexSummary {
  floorsMin: number | null;
  floorsMax: number | null;
  approvalYear: number | null;
  parkingTotal: number | null;
  parkingPerHousehold: number | null;
  floorAreaRatio: number | null;
  buildingCoverageRatio: number | null;
  heatingType: string | null;
  builder: string | null;
  region: { code: string; name: string; fullName: string } | null;
  areaTypes: ComplexAreaTypeView[];
  photos: ComplexPhotoView[];
  /** Latest non-cancelled trade per 평형 and deal type. */
  latestTrades: TradeView[];
  listingSummary: ComplexListingsSummary;
  isFavorite: boolean;
}

export interface TradeStatPoint {
  yearMonth: number;
  tradeCount: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianMonthlyRent: number | null;
}

export interface TradeStatSeries {
  exclusiveArea: number;
  exclusivePyeong: number;
  areaTypeId: string | null;
  pyeongLabel: string;
  points: TradeStatPoint[];
}

export interface ComplexStatsView {
  complexId: string;
  dealType: TradeDealType;
  fromYm: number | null;
  toYm: number | null;
  /** Monthly trend per 평형. */
  series: TradeStatSeries[];
  /** Monthly trend across all 평형 of the complex. */
  overall: TradeStatPoint[];
  /** Latest non-cancelled trade per 평형 for this deal type. */
  latest: TradeView[];
}

export interface ComplexListingCounts {
  total: number;
  byDealType: Record<DealType, number>;
}

export interface PopularComplexItem extends ComplexSummary {
  rank: number;
  /** Time-decayed view score over the last 30 days. */
  score: number;
  listingCounts: ComplexListingCounts;
}

export interface ComplexSuggestion {
  id: string;
  name: string;
  assetType: AssetType;
  address: string | null;
  emdName: string | null;
  lat: number;
  lng: number;
  households: number | null;
  activeListingCount: number;
}

export interface ComplexAutocompleteResult {
  regions: RegionView[];
  complexes: ComplexSuggestion[];
}

export interface FavoriteComplexItem {
  favoritedAt: string;
  complex: ComplexSummary;
}

export interface AdminComplexAreaTypeView extends ComplexAreaTypeView {
  /** Trades matched to this 평형 (cancelled included). */
  tradeCount: number;
  /** 만원, latest non-cancelled 매매 of this 평형. */
  lastSalePrice: number | null;
}

export interface AdminComplexView
  extends Omit<ComplexDetail, 'latestTrades' | 'listingSummary' | 'isFavorite' | 'areaTypes'> {
  jibun: string | null;
  externalCode: string | null;
  areaTypes: AdminComplexAreaTypeView[];
  tradeCount: number;
  trades: {
    /** Trades matched to the 단지 (= tradeCount). */
    total: number;
    /** Matched to the 단지 but to no 평형 (non-cancelled). */
    unmatched: number;
    /** Latest non-cancelled deal date (YYYY-MM-DD). */
    lastDealDate: string | null;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AdminComplexListItem extends ComplexSummary {
  externalCode: string | null;
  deletedAt: string | null;
}

export interface TradeSyncRunView {
  id: string;
  kind: TradeSyncKind;
  sggCode: string;
  yearMonth: number;
  status: TradeSyncStatus;
  fetchedCount: number;
  upsertedCount: number;
  matchedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface TradeSyncResult {
  yearMonth: number;
  runs: TradeSyncRunView[];
}

export interface TradeRematchResult {
  scanned: number;
  /** Previously unmatched trades now attached to a 단지. */
  matched: number;
  /** Trades detached (their 단지 was deleted or is contradicted by the 국토교통부 code / 지번). */
  unmatched: number;
  complexesRecomputed: number;
}

/** Background trade-sync job kinds the admin can start and poll. */
export type TradeSyncJobKind = 'MONTH' | 'REMATCH';
export type TradeSyncJobState = 'waiting' | 'delayed' | 'active' | 'completed' | 'failed';

/** 202 answer of POST /admin/complexes/trade-sync and /rematch. */
export interface TradeSyncJobAccepted {
  jobId: string;
  kind: TradeSyncJobKind;
  state: TradeSyncJobState;
}

export interface TradeSyncJobView extends TradeSyncJobAccepted {
  /** { yearMonth, kinds } for MONTH, { fromYm } for REMATCH. */
  params: Record<string, unknown>;
  attemptsMade: number;
  /** Result once completed: TradeSyncResult (MONTH) or TradeRematchResult (REMATCH). */
  result: TradeSyncResult | TradeRematchResult | null;
  failedReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}
