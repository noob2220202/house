import {
  AGENCY_DOCUMENT_TYPE_LABEL,
  AGENCY_STATUS_LABEL,
  AgencyDocumentType,
  type AgencyStatus,
  ASSET_TYPE_LABEL,
  DEAL_REQUEST_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestStatus,
  DealRequestType,
  DealType,
  LISTING_STATUS_LABEL,
  type ListingStatus,
  maskPhone,
  ReportAction,
  ReportStatus,
  type UserStatus,
  type AssetType,
} from '@house/shared';
import type { StatusTone } from '@house/ui';
import {
  formatDealPrice,
  formatFloor,
  formatManwon,
  formatMonthly,
  formatPriceRange,
  formatPyeong,
  formatSqm,
} from '@/lib/format';
import type {
  AdminDealRequestListItem,
  AdminListingListItem,
  ListingReviewFlag,
  RegistryCheckStatus,
} from '../api/schemas';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

// ---------- agencies -------------------------------------------------------------------------

export const AGENCY_STATUS_META: Record<AgencyStatus, StatusMeta> = {
  PENDING: { label: AGENCY_STATUS_LABEL.PENDING, tone: 'review' },
  APPROVED: { label: AGENCY_STATUS_LABEL.APPROVED, tone: 'live' },
  REJECTED: { label: AGENCY_STATUS_LABEL.REJECTED, tone: 'rejected' },
  SUSPENDED: { label: AGENCY_STATUS_LABEL.SUSPENDED, tone: 'ended' },
};

/** Documents an application needs before it can be approved. */
export const REQUIRED_AGENCY_DOCUMENTS: readonly AgencyDocumentType[] = [
  AgencyDocumentType.REGISTRATION_CERT,
  AgencyDocumentType.BUSINESS_REG_CERT,
];

/** "서류 3종 확인" / "사업자등록증 누락" summary of the submitted documents. */
export function documentSummary(types: readonly AgencyDocumentType[]): {
  complete: boolean;
  label: string;
  missing: AgencyDocumentType[];
} {
  const submitted = new Set(types);
  const missing = REQUIRED_AGENCY_DOCUMENTS.filter((t) => !submitted.has(t));
  if (missing.length > 0) {
    return {
      complete: false,
      missing,
      label: `${missing.map((t) => AGENCY_DOCUMENT_TYPE_LABEL[t]).join(' · ')} 누락`,
    };
  }
  return { complete: true, missing, label: `${submitted.size}종 확인` };
}

export const REGISTRY_STATUS_META: Record<
  RegistryCheckStatus,
  { label: string; tone: 'success' | 'warn' | 'danger' | 'neutral' }
> = {
  MATCHED: { label: '등록 정보 일치', tone: 'success' },
  MISMATCH: { label: '일부 불일치', tone: 'warn' },
  NOT_FOUND: { label: '등록번호 조회 안 됨', tone: 'danger' },
  UNAVAILABLE: { label: '조회 실패', tone: 'neutral' },
};

/** Whole days an application has been waiting, in KST calendar days ("3일째 대기"). */
export function waitingDays(createdAt: string, now: Date = new Date()): number {
  const DAY = 86_400_000;
  const KST = 9 * 3_600_000;
  const start = Math.floor((new Date(createdAt).getTime() + KST) / DAY);
  const today = Math.floor((now.getTime() + KST) / DAY);
  return Number.isFinite(start) ? Math.max(0, today - start) : 0;
}

/** Waiting time of an application: "오늘 신청" on the day it was filed, then "3일째 대기". */
export function waitingLabel(days: number): string {
  return days <= 0 ? '오늘 신청' : `${days}일째 대기`;
}

/**
 * One-click approval rule shared by the 승인 queue (/agencies) and the dashboard: every required
 * document is in and the 국가공간정보 중개업 lookup matched. Anything else goes through 심사하기.
 */
export function readyToApprove(
  documentsComplete: boolean,
  registryStatus: RegistryCheckStatus | null | undefined,
): boolean {
  return documentsComplete && registryStatus === 'MATCHED';
}

// ---------- listings -------------------------------------------------------------------------

export const LISTING_STATUS_META: Record<ListingStatus, StatusMeta> = {
  DRAFT: { label: LISTING_STATUS_LABEL.DRAFT, tone: 'ended' },
  ACTIVE: { label: LISTING_STATUS_LABEL.ACTIVE, tone: 'live' },
  RESERVED: { label: LISTING_STATUS_LABEL.RESERVED, tone: 'scheduled' },
  CLOSED: { label: LISTING_STATUS_LABEL.CLOSED, tone: 'ended' },
  HIDDEN: { label: LISTING_STATUS_LABEL.HIDDEN, tone: 'rejected' },
};

export const REVIEW_FLAG_LABEL: Record<ListingReviewFlag, string> = {
  REPORTED: '신고 접수',
  UNVERIFIED: '실매물 미확인',
  VERIFICATION_EXPIRED: '확인 기한 경과',
  PRICE_OUTLIER: '시세 이탈',
};

const HISTORY_LABEL: Record<string, string> = {
  LISTING_CREATED: '매물 등록',
  LISTING_PUBLISHED: '광고 시작',
  LISTING_UPDATED: '정보 수정',
  LISTING_PRICE_CHANGED: '가격 변경',
  LISTING_VERIFIED: '실매물 확인',
  LISTING_RESERVED: '계약중 전환',
  LISTING_CLOSED: '거래완료 처리',
  LISTING_HIDDEN: '숨김 처리',
  LISTING_UNHIDDEN: '숨김 해제',
  LISTING_FORCE_CLOSED: '강제 종료',
  LISTING_CO_BROKER_JOINED: '공동중개 참여',
  LISTING_CO_BROKER_WITHDRAWN: '공동중개 철회',
  LISTING_REPORTED: '신고 접수',
  DEAL_REQUEST_CREATED: '요청 등록',
  DEAL_REQUEST_SPAM_FLAGGED: '스팸 표시',
  DEAL_REQUEST_SPAM_CLEARED: '스팸 표시 해제',
  DEAL_REQUEST_CLOSED: '관리자 종료',
  DEAL_REQUEST_CANCELLED: '요청자 취소',
  DEAL_REQUEST_MATCHED: '매칭 완료',
  DEAL_REQUEST_EXPIRED: '기간 만료',
  PROPOSAL_SENT: '중개사 제안',
  CONTACT_GRANTED: '연락처 공개 동의',
};
/** Human label of an audit action; unknown actions show the raw code. */
export function historyLabel(action: string): string {
  return HISTORY_LABEL[action] ?? action;
}
/** Actions taken by moderators — drawn in the danger tone on timelines. */
export function isModerationAction(action: string): boolean {
  return /HIDDEN|FORCE_CLOSED|SPAM_FLAGGED|REPORTED/.test(action) && !/UNHIDDEN/.test(action);
}

type ListingPriceFields = Pick<
  AdminListingListItem,
  'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice'
>;

/** Headline price of an admin listing row: "4억 4,500", "500/42". */
export function listingPrice(l: ListingPriceFields): string {
  return formatDealPrice({
    dealType: l.dealType,
    price:
      l.dealType === DealType.PRESALE
        ? (l.presalePrice ?? l.salePrice)
        : l.dealType === DealType.SALE
          ? l.salePrice
          : l.deposit,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
}

type ListingNameFields = Pick<
  AdminListingListItem,
  'title' | 'complexName' | 'buildingName' | 'dong' | 'emdName'
> & { assetType?: AssetType | null };

/** "신대 레이크파크 1단지 103동" — complex/building + 동, falling back to the title. */
export function listingName(l: ListingNameFields): string {
  const base = l.complexName ?? l.buildingName;
  if (base) return l.dong ? `${base} ${l.dong}` : base;
  return (
    l.title ?? `${l.emdName ?? ''} ${l.assetType ? ASSET_TYPE_LABEL[l.assetType] : '매물'}`.trim()
  );
}

/** "34평 · 전용 84.98㎡ · 고/25층" spec line (평형 from the supply area when known). */
export function listingSpec(
  l: Pick<
    AdminListingListItem,
    'supplyArea' | 'exclusiveArea' | 'floorClass' | 'floor' | 'totalFloors'
  >,
): string {
  const parts: string[] = [];
  if (l.supplyArea) parts.push(formatPyeong(l.supplyArea));
  if (l.exclusiveArea) parts.push(`전용 ${formatSqm(l.exclusiveArea)}`);
  const floor = formatFloor({
    floor: l.floor ?? undefined,
    totalFloors: l.totalFloors ?? undefined,
    floorClass: l.floorClass ?? undefined,
    showExact: true,
  });
  if (floor) parts.push(floor);
  return parts.join(' · ');
}

/** Short reference shown instead of the raw UUID ("#0B1F-0012" style: last 8 hex chars). */
export function shortId(id: string): string {
  const hex = id.replace(/-/g, '').toUpperCase();
  return `#${hex.slice(-8, -4)}-${hex.slice(-4)}`;
}

// ---------- reports --------------------------------------------------------------------------

export const REPORT_STATUS_META: Record<ReportStatus, StatusMeta> = {
  RECEIVED: { label: '접수', tone: 'review' },
  IN_REVIEW: { label: '검토 중', tone: 'scheduled' },
  RESOLVED: { label: '조치 완료', tone: 'live' },
  REJECTED: { label: '기각', tone: 'ended' },
};

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  NONE: '조치 없음',
  LISTING_HIDDEN: '매물 숨김',
  AGENCY_WARNED: '중개사 경고',
  LISTING_HIDDEN_AGENCY_WARNED: '매물 숨김 + 중개사 경고',
};

/** Reports should be handled within 24 hours of arriving. */
export const REPORT_SLA_HOURS = 24;

/** Hours since the report arrived and whether the 24h target is missed (open reports only). */
export function reportSla(
  createdAt: string,
  status: ReportStatus,
  now: Date = new Date(),
): { hours: number; overdue: boolean; open: boolean } {
  const open = status === ReportStatus.RECEIVED || status === ReportStatus.IN_REVIEW;
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 3_600_000),
  );
  return { hours, open, overdue: open && hours >= REPORT_SLA_HOURS };
}

// ---------- deal requests --------------------------------------------------------------------

export const DEAL_REQUEST_STATUS_META: Record<DealRequestStatus, StatusMeta> = {
  OPEN: { label: '진행 중', tone: 'live' },
  MATCHED: { label: '매칭 완료', tone: 'scheduled' },
  CLOSED: { label: '종료', tone: 'ended' },
  CANCELLED: { label: '취소', tone: 'ended' },
  EXPIRED: { label: '기간 만료', tone: 'ended' },
};

type DealRequestSummaryFields = Pick<
  AdminDealRequestListItem,
  | 'type'
  | 'assetType'
  | 'dealTypes'
  | 'complexName'
  | 'emdName'
  | 'exclusiveArea'
  | 'regionNames'
  | 'areaMin'
  | 'areaMax'
>;

/** "전용 84㎡" / "전용 59~85㎡" — the (wanted) exclusive area of a request, or null. */
export function dealRequestArea(
  r: Pick<DealRequestSummaryFields, 'exclusiveArea' | 'areaMin' | 'areaMax'>,
): string | null {
  const round = (sqm: number) => Math.floor(sqm).toLocaleString('ko-KR');
  if (r.exclusiveArea) return `전용 ${round(r.exclusiveArea)}㎡`;
  if (r.areaMin && r.areaMax)
    return r.areaMin === r.areaMax
      ? `전용 ${round(r.areaMin)}㎡`
      : `전용 ${round(r.areaMin)}~${round(r.areaMax)}㎡`;
  if (r.areaMin) return `전용 ${round(r.areaMin)}㎡ 이상`;
  if (r.areaMax) return `전용 ${round(r.areaMax)}㎡ 이하`;
  return null;
}

/** One-line title: "신대 레이크파크 1단지 · 전용 84㎡ 매매" / "신대지구·선월지구 · 전용 84㎡ 매매". */
export function dealRequestTitle(r: DealRequestSummaryFields): string {
  const where =
    r.type === DealRequestType.SELL_OR_LEASE
      ? (r.complexName ?? r.emdName ?? ASSET_TYPE_LABEL[r.assetType])
      : r.regionNames.length > 0
        ? r.regionNames.length > 2
          ? `${r.regionNames.slice(0, 2).join('·')} 외 ${r.regionNames.length - 2}곳`
          : r.regionNames.join('·')
        : (r.complexName ?? '지역 무관');
  const deals = r.dealTypes.map((d) => DEAL_TYPE_LABEL[d]).join('·');
  const what = [dealRequestArea(r), deals || assetLabel(r.assetType)].filter(Boolean).join(' ');
  return what ? `${where} · ${what}` : where;
}
function assetLabel(assetType: AssetType): string {
  return ASSET_TYPE_LABEL[assetType];
}

/** Price line: 내놓기 "희망가 4억 5,000" · 구하기 "4억 5,000 이하" / "보증금 500 · 월 40 이하". */
export function dealRequestPrice(
  r: Pick<
    AdminDealRequestListItem,
    | 'type'
    | 'dealTypes'
    | 'desiredSalePrice'
    | 'desiredDeposit'
    | 'desiredMonthlyRent'
    | 'priceMin'
    | 'priceMax'
    | 'depositMin'
    | 'depositMax'
    | 'rentMin'
    | 'rentMax'
  >,
): string {
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    if (r.desiredMonthlyRent != null)
      return `희망가 ${formatMonthly(r.desiredDeposit ?? 0, r.desiredMonthlyRent)}`;
    const amount = r.desiredSalePrice ?? r.desiredDeposit;
    return amount != null ? `희망가 ${formatManwon(amount)}` : '희망가 협의';
  }
  const bound = (min?: number | null, max?: number | null) =>
    min == null && max != null
      ? `${formatManwon(max)} 이하`
      : min != null && max == null
        ? `${formatManwon(min)} 이상`
        : formatPriceRange(min, max);
  const parts: string[] = [];
  if (r.priceMin != null || r.priceMax != null) parts.push(bound(r.priceMin, r.priceMax));
  if (r.depositMin != null || r.depositMax != null)
    parts.push(`보증금 ${bound(r.depositMin, r.depositMax)}`);
  if (r.rentMin != null || r.rentMax != null) parts.push(`월 ${bound(r.rentMin, r.rentMax)}`);
  return parts.length > 0 ? parts.join(' · ') : '금액 협의';
}

export function dealRequestTypeLabel(type: DealRequestType): string {
  return DEAL_REQUEST_TYPE_LABEL[type];
}

// ---------- users ----------------------------------------------------------------------------

export const USER_STATUS_META: Record<UserStatus, StatusMeta> = {
  ACTIVE: { label: '정상', tone: 'live' },
  SUSPENDED: { label: '이용 정지', tone: 'rejected' },
  WITHDRAWN: { label: '탈퇴', tone: 'ended' },
};

/** Short role names for tables (the shared ROLE_LABEL is the long legal wording). */
export const USER_ROLE_SHORT: Record<'USER' | 'AGENT' | 'AGENCY_OWNER', string> = {
  USER: '일반회원',
  AGENT: '소속 중개사',
  AGENCY_OWNER: '대표 중개사',
};

/**
 * The members list should receive values the API already masked (the full ones only come with the
 * audit-logged detail read). Masking is idempotent so the list works either way.
 */
const isMasked = (value: string) => value.includes('*');

/** "seoyun.han@example.com" → "se*******@example.com" (lists never show the full address). */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  if (isMasked(email)) return email;
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const keep = Math.min(2, Math.max(1, local.length - 1));
  return `${local.slice(0, keep)}${'*'.repeat(Math.max(3, local.length - keep))}${email.slice(at)}`;
}

/** "한서윤" → "한*윤", "김민" → "김*" (lists show masked names of private members). */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  if (isMasked(name)) return name;
  const chars = Array.from(name.trim());
  if (chars.length <= 1) return name;
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/** "01012345678" → "010-****-5678"; a value the API already masked is shown as is. */
export function maskPhoneOnce(phone: string | null | undefined): string {
  if (!phone) return '';
  return isMasked(phone) ? phone : maskPhone(phone);
}

/** Best display name of a member: nickname → name → "회원". */
export function userDisplayName(u: { nickname?: string | null; name?: string | null }): string {
  return u.nickname || u.name || '이름 없음';
}

// ---------- reports: target & resolution helpers ------------------------------------------------

interface ReportTargetFields {
  targetType: 'LISTING' | 'AGENCY';
  listing?: ListingNameFields | null;
  agency?: { name: string } | null;
}

/** "연향 센트럴 108동" / "금당리버 공인중개사사무소" — what the report is about. */
export function reportTargetTitle(r: ReportTargetFields): string {
  if (r.targetType === 'LISTING') return r.listing ? listingName(r.listing) : '삭제된 매물';
  return r.agency?.name ?? '삭제된 중개사무소';
}

/** Maps the two resolution checkboxes to the backend `ReportAction`. */
export function reportActionOf(hideListing: boolean, warnAgency: boolean): ReportAction {
  if (hideListing && warnAgency) return ReportAction.LISTING_HIDDEN_AGENCY_WARNED;
  if (hideListing) return ReportAction.LISTING_HIDDEN;
  if (warnAgency) return ReportAction.AGENCY_WARNED;
  return ReportAction.NONE;
}

/** "처리 기한 초과 · 27시간째" / "처리 기한 5시간 남음" for open reports; null once handled. */
export function reportSlaLabel(
  createdAt: string,
  status: ReportStatus,
  now: Date = new Date(),
): { text: string; overdue: boolean } | null {
  const sla = reportSla(createdAt, status, now);
  if (!sla.open) return null;
  if (sla.overdue) {
    const days = Math.floor(sla.hours / 24);
    return {
      overdue: true,
      text: days >= 2 ? `처리 기한 초과 · ${days}일째` : `처리 기한 초과 · ${sla.hours}시간째`,
    };
  }
  const leftMin = Math.max(
    1,
    REPORT_SLA_HOURS * 60 - Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000),
  );
  return {
    overdue: false,
    text:
      leftMin >= 60
        ? `처리 기한 ${Math.floor(leftMin / 60)}시간 남음`
        : `처리 기한 ${leftMin}분 남음`,
  };
}

// ---------- deal requests: proposals & visibility ----------------------------------------------

export const PROPOSAL_STATUS_META: Record<
  'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN',
  StatusMeta
> = {
  SENT: { label: '전달됨', tone: 'scheduled' },
  VIEWED: { label: '열람', tone: 'review' },
  ACCEPTED: { label: '수락', tone: 'live' },
  DECLINED: { label: '거절', tone: 'ended' },
  WITHDRAWN: { label: '철회', tone: 'ended' },
};

export const DEAL_REQUEST_VISIBILITY_LABEL: Record<
  'ALL_AGENCIES_IN_REGION' | 'SELECTED_AGENCIES',
  string
> = {
  ALL_AGENCIES_IN_REGION: '지역 내 모든 중개사무소',
  SELECTED_AGENCIES: '선택한 중개사무소만',
};

/** Spam state of a request: flagged by a moderator, suspected by automatic signals, or clean. */
export function dealRequestSpamState(r: {
  spamFlaggedAt?: string | null;
  spamSignalCount: number;
  status: DealRequestStatus;
}): 'flagged' | 'suspected' | 'clean' {
  if (r.spamFlaggedAt) return 'flagged';
  if (r.spamSignalCount > 0 && r.status === DealRequestStatus.OPEN) return 'suspected';
  return 'clean';
}

// ---------- users: privacy helpers -------------------------------------------------------------

/** A withdrawn member whose personal data has been destroyed (30 days after leaving). */
export function isScrubbed(u: { piiScrubbedAt?: string | null }): boolean {
  return !!u.piiScrubbedAt;
}
