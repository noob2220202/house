import {
  SUBSCRIPTION_REQUIRED_FEATURE,
  type FaqCategory,
  type TradeSyncKind,
  type TradeSyncStatus,
} from '@house/shared';
import type { IconName } from '@house/ui';
import type { HomeSectionKey } from '../api/schemas';

export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  GENERAL: '서비스 일반',
  ACCOUNT: '회원·계정',
  LISTING: '매물·지도',
  AGENCY: '중개사무소',
  DEAL_REQUEST: '내놓기·구하기',
  AD: '광고',
};
export const FAQ_CATEGORIES = Object.keys(FAQ_CATEGORY_LABEL) as FaqCategory[];

export const TRADE_SYNC_KIND_LABEL: Record<TradeSyncKind, string> = {
  APT_TRADE: '아파트 매매',
  APT_RENT: '아파트 전월세',
};
export const TRADE_SYNC_STATUS_LABEL: Record<TradeSyncStatus, string> = {
  RUNNING: '진행 중',
  SUCCEEDED: '완료',
  FAILED: '실패',
};

/** 202611 → "2026년 11월" */
export function formatYearMonthInt(ym: number): string {
  return `${Math.floor(ym / 100)}년 ${ym % 100}월`;
}
/** 202611 → "2026-11" (value of <input type="month">) and back. */
export const ymToInput = (ym: number) =>
  `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}`;
export const inputToYm = (value: string): number | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
};

// ---------- 메인 화면 구성 ----------

export interface HomeSectionMeta {
  label: string;
  description: string;
  icon: IconName;
  /** Always shown: the switch is disabled. */
  locked?: boolean;
  /** Where the section's content is managed. */
  manage?: { label: string; href: string };
  /** Height of the wireframe block in the preview (px at 1×). */
  previewHeight: number;
}

export const HOME_SECTION_META: Record<HomeSectionKey, HomeSectionMeta> = {
  HERO_SEARCH: {
    label: '히어로 검색 · 지도',
    description: '검색창, 거래 유형 탭, 지역 요약 지도',
    icon: 'search',
    locked: true,
    previewHeight: 96,
  },
  CATEGORY_TILES: {
    label: '매물 종류 바로가기',
    description: '아파트·분양권 / 원룸·투룸 / 주택 / 상업·업무 / 토지',
    icon: 'grid',
    previewHeight: 40,
  },
  MAIN_BANNER: {
    label: '메인 배너',
    description: '메인 히어로 배너 · 띠배너 슬롯',
    icon: 'megaphone',
    manage: { label: '배너·팝업 관리', href: '/banners' },
    previewHeight: 44,
  },
  POPULAR_COMPLEXES: {
    label: '자주 찾는 단지',
    description: '조회수 기준 단지 순위표',
    icon: 'layers',
    manage: { label: '단지 관리', href: '/complexes' },
    previewHeight: 84,
  },
  NEW_LISTINGS: {
    label: '새로 올라온 매물',
    description: '최근 실매물 확인 순 매물 카드',
    icon: 'building',
    previewHeight: 72,
  },
  DEAL_REQUEST_CTA: {
    label: '내놓기 · 구하기 안내',
    description: '"집을 내놓을 생각이 있나요?" 안내 카드 2개',
    icon: 'home-up',
    previewHeight: 48,
  },
  FEATURED_AGENCIES: {
    label: '우리 동네 중개사무소',
    description: '추천 중개사무소 카드',
    icon: 'store',
    previewHeight: 56,
  },
  LOCAL_VIDEOS: {
    label: '동네TV',
    description: '공개 중인 영상 4개',
    icon: 'play',
    manage: { label: '동네TV 관리', href: '/content/videos' },
    previewHeight: 60,
  },
  NOTICES: {
    label: '공지사항',
    description: '고정 공지와 최신 공지 3건',
    icon: 'document',
    manage: { label: '공지사항 관리', href: '/content/notices' },
    previewHeight: 36,
  },
  APP_BAND: {
    label: '앱 안내 띠',
    description: '앱 출시 안내 (앱 출시 전에는 숨김 권장)',
    icon: 'info',
    previewHeight: 32,
  },
};

// ---------- 기능 설정 ----------

export const FEATURE_META: Record<string, { label: string; description: string }> = {
  dealRequests: {
    label: '내놓기·구하기',
    description: '회원이 내놓기·구하기 요청을 등록하고 중개사무소 제안을 받을 수 있어요.',
  },
  tradeHistory: {
    label: '실거래가 표시',
    description: '단지 화면에 국토교통부 실거래가와 시세 추이를 보여 줘요.',
  },
  community: {
    label: '커뮤니티 메뉴',
    description: '상단 메뉴에 커뮤니티(동네TV) 항목을 보여 줘요.',
  },
  appBand: {
    label: '앱 안내 띠',
    description: '메인 화면 아래에 앱 설치 안내를 보여 줘요. 앱 출시 후에 켜 주세요.',
  },
  [SUBSCRIPTION_REQUIRED_FEATURE.SITE]: {
    label: '사무소 홈페이지 유료 적용',
    description:
      '켜면 홈페이지 이용 기간 중인 사무소만 홈페이지가 열려요. 끄면 승인된 모든 사무소가 무료로 써요.',
  },
  [SUBSCRIPTION_REQUIRED_FEATURE.PLATFORM]: {
    label: '메인 입점 유료 적용 (준비 중 — 아직 적용되지 않아요)',
    description:
      '메인 사이트 입점 이용 기간을 확인하는 기능은 준비 중이에요. 켜 두어도 지금은 모든 사무소가 그대로 입점해요.',
  },
};

// ---------- 작업 기록 ----------

export const AUDIT_RESOURCE_LABEL: Record<string, string> = {
  Notice: '공지사항',
  Faq: 'FAQ',
  LocalVideo: '동네TV',
  TermsDocument: '약관',
  SiteSetting: '사이트 설정',
  Complex: '단지',
  TradeSyncRun: '실거래가 동기화',
  AdminUser: '관리자 계정',
  Banner: '배너',
  Popup: '팝업',
  Agency: '중개사무소',
  Listing: '매물',
  Report: '신고',
  User: '회원',
  DealRequest: '내놓기·구하기',
  AgencySite: '사무소 홈페이지',
  AgencySubscription: '이용 기간',
};
export const auditResourceLabel = (type: string) => AUDIT_RESOURCE_LABEL[type] ?? type;

const AUDIT_VERB: Record<string, string> = {
  create: '등록',
  update: '수정',
  delete: '삭제',
  publish: '게시',
  unpublish: '게시 중단',
  reorder: '순서 변경',
  approve: '승인',
  reject: '반려',
  suspend: '이용 정지',
  unsuspend: '정지 해제',
  warn: '경고',
  hide: '숨김',
  unhide: '숨김 해제',
  resolve: '처리',
  trigger: '수동 실행',
  run: '정기 실행',
  add: '추가',
  remove: '삭제',
  view_personal_data: '개인정보 열람',
  reset_totp: 'OTP 초기화',
  reset_password: '비밀번호 재설정',
  request: '신청',
  resume: '정지 해제',
  cancel: '취소',
};
const AUDIT_NOUN: Record<string, string> = {
  notice: '공지사항',
  faq: 'FAQ',
  video: '동네TV',
  terms: '약관',
  site_setting: '사이트 설정',
  complex: '단지',
  area_type: '평형',
  photo: '사진',
  trade_sync: '실거래가 동기화',
  admin: '관리자 계정',
  banner: '배너',
  popup: '팝업',
  agency: '중개사무소',
  listing: '매물',
  report: '신고',
  user: '회원',
  deal_request: '내놓기·구하기',
  agency_site: '사무소 홈페이지',
  site: '홈페이지',
  subscription: '이용 기간',
  agency_subscription: '이용 기간',
};

/** "complex.photo.add" → "단지 사진 추가"; unknown actions fall back to the raw string. */
export function auditActionLabel(action: string): string {
  const parts = action.split('.');
  const verb = AUDIT_VERB[parts[parts.length - 1] ?? ''];
  const nouns = parts.slice(0, -1).map((p) => AUDIT_NOUN[p]);
  if (!verb || nouns.length === 0 || nouns.some((n) => !n)) return action;
  return `${nouns.join(' ')} ${verb}`;
}

export type AuditTone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
/** Badge tone by the kind of change. */
export function auditActionTone(action: string): AuditTone {
  const verb = action.split('.').pop() ?? '';
  if (['delete', 'remove', 'reject', 'suspend', 'hide', 'cancel'].includes(verb)) return 'danger';
  if (['create', 'add', 'approve', 'publish', 'unsuspend', 'unhide', 'resume'].includes(verb))
    return 'success';
  if (['warn', 'view_personal_data', 'reset_totp', 'reset_password'].includes(verb)) return 'warn';
  if (['trigger', 'run', 'resolve', 'request'].includes(verb)) return 'brand';
  return 'neutral';
}

/** Field labels for the before/after diff (unknown paths are shown as-is). */
export const FIELD_LABEL: Record<string, string> = {
  title: '제목',
  content: '내용',
  isPinned: '상단 고정',
  isPublished: '공개',
  publishedAt: '게시 일시',
  category: '분류',
  question: '질문',
  answer: '답변',
  sortOrder: '순서',
  order: '순서',
  youtubeUrl: 'YouTube 주소',
  youtubeVideoId: '영상 ID',
  description: '설명',
  regionCode: '지역 코드',
  complexId: '연결 단지',
  type: '종류',
  version: '버전',
  isRequired: '필수 동의',
  effectiveAt: '적용일',
  companyName: '상호',
  ceoName: '대표',
  businessNumber: '사업자등록번호',
  mailOrderNumber: '통신판매업 신고번호',
  address: '주소',
  privacyOfficer: '개인정보보호책임자',
  phone: '전화번호',
  email: '이메일',
  hours: '운영 시간',
  kakaoChannelUrl: '카카오톡 채널',
  name: '이름',
  role: '권한',
  status: '상태',
  ipAllowlist: '허용 IP',
  households: '세대수',
  buildings: '동수',
  floorsMin: '최저층',
  floorsMax: '최고층',
  approvalDate: '사용승인일',
  builtYear: '준공 연도',
  parkingTotal: '총 주차대수',
  parkingPerHousehold: '세대당 주차',
  floorAreaRatio: '용적률',
  buildingCoverageRatio: '건폐율',
  heatingType: '난방',
  builder: '시공사',
  externalCode: '외부 코드',
  roadAddress: '도로명 주소',
  jibunAddress: '지번 주소',
  emdCode: '읍면동 코드',
  emdName: '읍면동',
  jibun: '지번',
  lat: '위도',
  lng: '경도',
  exclusiveArea: '전용면적',
  supplyArea: '공급면적',
  typeName: '타입명',
  pyeongLabel: '평형 표기',
  rooms: '방',
  baths: '욕실',
  caption: '사진 설명',
  photoCount: '사진 수',
  yearMonth: '대상 월',
  kinds: '자료 종류',
  fetchedCount: '조회 건수',
  upsertedCount: '반영 건수',
  action: '조치',
  resolutionNote: '처리 메모',
  hiddenReason: '숨김 사유',
  suspendedReason: '정지 사유',
  warningCount: '경고 횟수',
  lastWarning: '최근 경고',
  startAt: '시작일',
  endAt: '종료일',
  approvedAt: '승인 일시',
  slug: '홈페이지 주소',
  requestedSlug: '신청 주소',
  color: '브랜드 색상',
  tagline: '한 줄 소개',
  requestedAt: '신청 일시',
  decidedAt: '처리 일시',
  decisionReason: '처리 사유',
  httpsReadyAt: '인증서 발급 일시',
  product: '상품',
  startsOn: '이용 시작일',
  endsOn: '이용 종료일',
  amountWon: '금액(원)',
  memo: '메모',
  canceledAt: '취소 일시',
};
export const fieldLabel = (path: string): string =>
  path
    .split('.')
    .map((part) => FIELD_LABEL[part] ?? part)
    .join(' › ');
