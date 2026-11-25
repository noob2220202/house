import type { DealType, AssetType } from '../enums/listing';
import type { RegionLevel } from '../enums/region';
import type {
  ComplexDataSource,
  TradeDealType,
  TradeSyncKind,
  TradeSyncStatus,
} from '../enums/complex';

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
  /** ADMIN (hand-made) or TRADE_BOOTSTRAP (created from 실거래가). */
  source: ComplexDataSource;
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
  source: ComplexDataSource;
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

// ---------- 단지 자동 생성 (실거래가 bootstrap) ----------

/** What the bootstrap does (dry run) or did with one candidate 단지. */
export type ComplexBootstrapAction =
  /** New 단지 (has coordinates). */
  | 'CREATE'
  /** Existing 단지: empty fields / 평형 filled in. */
  | 'UPDATE'
  /** Existing 단지, nothing to fill in. */
  | 'UNCHANGED'
  /** Not created: the address could not be geocoded inside the service region. */
  | 'NEEDS_LOCATION'
  /** Not created / updated (unknown 법정동, ambiguous name match, deleted by an admin, …). */
  | 'SKIP';

export interface ComplexBootstrapItem {
  action: ComplexBootstrapAction;
  /** Korean reason for SKIP / NEEDS_LOCATION, null otherwise. */
  reason: string | null;
  name: string;
  /** "연향동" / "해룡면 신대리" */
  emdName: string | null;
  /** 8-digit 읍면동 code. */
  emdCode: string | null;
  jibunAddress: string | null;
  roadAddress: string | null;
  builtYear: number | null;
  /** 평형 derived from distinct 전용면적. */
  areaTypeCount: number;
  /** 전용면적 ㎡ of those 평형, ascending. */
  exclusiveAreas: number[];
  hasLocation: boolean;
  /** Canonical aptSeq, null for rows without one (some 전월세 rows). */
  externalCode: string | null;
  /** 매매 / 전월세 rows of the period. */
  saleCount: number;
  rentCount: number;
  /** Matched (UPDATE / UNCHANGED) or created 단지. */
  complexId: string | null;
}

export interface ComplexBootstrapPreview {
  fromYm: number;
  toYm: number;
  /** Valid 실거래 rows read (매매 + 전월세). */
  rows: number;
  candidates: number;
  toCreate: number;
  toUpdate: number;
  unchanged: number;
  needsLocation: number;
  skipped: number;
  /** Up to 50 items, CREATE first. */
  sample: ComplexBootstrapItem[];
  /** Every NEEDS_LOCATION item (up to 500) so an admin can register them by hand. */
  needsLocationItems: ComplexBootstrapItem[];
  /** Every SKIP item (up to 500). */
  skippedItems: ComplexBootstrapItem[];
}

export interface ComplexBootstrapResult {
  created: number;
  updated: number;
  unchanged: number;
  needsLocation: number;
  skipped: number;
  areaTypesCreated: number;
  /** 실거래가 sync jobs enqueued for the same months (so trades link right away). */
  tradeSyncJobs: number;
}

export type ComplexBootstrapPhase = 'queued' | 'fetch' | 'geocode' | 'write' | 'done';

export interface ComplexBootstrapProgress {
  phase: ComplexBootstrapPhase;
  /** Steps done / total of the current phase (months × 2 APIs, addresses, 단지). */
  done: number;
  total: number;
  /** Overall 0–100. */
  percent: number;
}

/** 202 answer of POST /admin/complexes/bootstrap. */
export interface ComplexBootstrapAccepted {
  jobId: string;
  state: TradeSyncJobState;
  dryRun: boolean;
  months: number;
}

/** GET /admin/complexes/bootstrap/:jobId (and the latest job: GET /admin/complexes/bootstrap). */
export interface ComplexBootstrapJobView {
  jobId: string;
  status: TradeSyncJobState;
  dryRun: boolean;
  months: number;
  fromYm: number;
  toYm: number;
  progress: ComplexBootstrapProgress;
  /** Set once the plan is computed (before any write of a real run). */
  preview: ComplexBootstrapPreview | null;
  /** Real runs only, once completed. */
  result: ComplexBootstrapResult | null;
  failedReason: string | null;
  createdAt: string;
  finishedAt: string | null;
}
