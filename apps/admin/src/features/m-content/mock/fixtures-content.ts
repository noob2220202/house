import { mockUuid } from './ids';

/**
 * Content fixtures of the admin mock (all fictional — design/drafts/system/mockdata.md, reference
 * date 2026-11-23). Rows mirror the Prisma models Notice / Faq / LocalVideo / TermsDocument.
 * Text content is PLAIN TEXT with light markup ("## 제목", "- 항목", "1. 항목") — the format the user
 * site renders (apps/web/src/features/w-content/lib/rich-text.ts).
 */

export interface MockNotice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number;
  createdByAdminName: string | null;
  createdAt: string;
  updatedAt: string;
}

const notice = (
  key: string,
  title: string,
  at: string,
  viewCount: number,
  content: string,
  flags: { pinned?: boolean; draft?: boolean; by?: string } = {},
): MockNotice => ({
  id: mockUuid(`notice-${key}`),
  title,
  content: content.trim(),
  isPinned: !!flags.pinned,
  isPublished: !flags.draft,
  publishedAt: flags.draft ? null : at,
  viewCount: flags.draft ? 0 : viewCount,
  createdByAdminName: flags.by ?? '한지우',
  createdAt: at,
  updatedAt: at,
});

export const NOTICES: MockNotice[] = [
  notice(
    'n16',
    '12월 정기 점검 안내 (12월 3일 새벽)',
    '2026-11-23T11:30:00+09:00',
    0,
    `
서비스 안정화를 위한 정기 점검을 진행합니다. 점검 시간에는 지도와 매물 검색을 이용할 수 없습니다.

## 점검 일시
2026년 12월 3일(목) 02:00 ~ 05:00

## 점검 내용
- 지도 서버 증설
- 실거래가 데이터 11월분 반영
`,
    { draft: true, by: '운영자' },
  ),
  notice(
    'n15',
    '연향들 도시개발사업 분양 단지 정보가 추가되었습니다',
    '2026-11-18T10:00:00+09:00',
    864,
    `
연향동 연향들 도시개발사업 구역의 분양 단지 정보를 지도에서 볼 수 있습니다.

## 추가된 내용
- 분양 단지 위치와 세대수, 입주 예정 시기
- 분양권 매물과 프리미엄(P) 표시
- 주변 단지 실거래가 비교

지도에서 "연향들"을 검색해 보세요.
`,
  ),
  notice(
    'n14',
    '허위매물을 신고하면 확인 후 포상해 드려요',
    '2026-11-10T09:00:00+09:00',
    2415,
    `
이미 거래된 매물이 그대로 올라와 있거나, 가격과 사진이 실제와 다른 매물을 발견하면 알려 주세요. 운영팀이 중개사무소에 확인한 뒤 사실로 드러나면 신고하신 분께 포상해 드립니다.

## 포상 기간
2026년 11월 10일(화) ~ 11월 30일(월)

## 신고 방법
1. 매물 상세 화면 아래의 "허위매물 신고"를 누릅니다.
2. 신고 사유를 고르고 확인한 내용을 적어 주세요.
3. 운영팀이 영업일 기준 2일 안에 확인 결과를 알림으로 보내 드립니다.

## 포상 기준
- 확인된 신고 1건마다 모바일 상품권 5,000원
- 한 분이 받을 수 있는 포상은 기간 중 5건까지
- 같은 매물은 가장 먼저 접수된 신고만 인정합니다
`,
    { pinned: true },
  ),
  notice(
    'n13',
    '개인정보처리방침 개정 안내 (11월 1일 적용)',
    '2026-10-23T10:00:00+09:00',
    1288,
    `
개인정보처리방침이 2026년 11월 1일부터 아래와 같이 바뀝니다.

## 바뀌는 내용 (1.0 → 1.1)
- 수집 항목을 필수와 선택으로 나눠 알기 쉽게 정리했습니다.
- 탈퇴한 뒤 개인정보를 따로 보관하는 기간(30일)과 파기 절차를 분명히 했습니다.

이전 버전은 약관 화면의 "버전" 선택에서 다시 볼 수 있습니다.
`,
    { pinned: true, by: '정다은' },
  ),
  notice(
    'n12',
    '내놓기·구하기 요청에 중개사 제안 알림이 추가되었습니다',
    '2026-10-15T14:00:00+09:00',
    932,
    `
내놓기·구하기 요청을 등록하면 지역 중개사무소의 제안이 도착할 때마다 알림으로 알려 드립니다.

- 알림은 MY > 알림에서 모아 볼 수 있어요.
- 연락처는 제안을 수락한 중개사무소에만 전달됩니다.
`,
  ),
  notice(
    'n11',
    '원룸·투룸 지도에 대학가 필터가 생겼어요',
    '2026-10-06T10:00:00+09:00',
    1104,
    `
순천대, 청암대, 제일대 주변 원룸을 한 번에 볼 수 있는 대학가 필터를 추가했습니다.

## 사용 방법
1. 원룸·투룸 지도를 엽니다.
2. 상단 필터에서 "대학가"를 누르고 학교를 고릅니다.
`,
  ),
  notice(
    'n10',
    '추석 연휴 고객센터 운영 안내',
    '2026-09-21T09:30:00+09:00',
    640,
    `
추석 연휴 기간에는 고객센터 전화 상담을 쉽니다.

## 휴무 기간
2026년 9월 24일(목) ~ 9월 27일(일)

문의는 1:1 문의로 남겨 주시면 9월 28일부터 순서대로 답변드립니다.
`,
    { by: '운영자' },
  ),
  notice(
    'n09',
    '실거래가 데이터가 매월 자동으로 갱신됩니다',
    '2026-09-08T10:00:00+09:00',
    775,
    `
국토교통부 실거래가 공개시스템의 아파트 매매·전월세 자료를 매월 자동으로 반영합니다.

- 갱신 시점: 매월 초 (전월 신고분)
- 계약 해제된 거래는 목록에서 "해제"로 표시합니다.
`,
  ),
  notice(
    'n08',
    '중개사무소 가입 승인 절차 안내',
    '2026-08-25T11:00:00+09:00',
    1530,
    `
개업공인중개사는 아래 서류를 제출하면 영업일 기준 2일 안에 승인 결과를 받을 수 있습니다.

1. 중개사무소 등록증
2. 사업자등록증
3. 공제증서 또는 보증보험 증권

등록번호는 국가공간정보 중개업 조회 결과와 자동으로 대조합니다.
`,
  ),
  notice(
    'n07',
    '서비스 이용약관 제정 안내',
    '2026-08-10T09:00:00+09:00',
    488,
    `
서비스 정식 오픈에 맞춰 이용약관을 제정했습니다. 적용일은 2026년 10월 1일입니다.
`,
    { by: '정다은' },
  ),
  notice(
    'n06',
    '공동중개 매물 표시 방식 안내',
    '2026-07-28T10:00:00+09:00',
    701,
    `
여러 중개사무소가 같은 매물을 올리면 1건으로 묶어 보여 드립니다. 매물 카드의 "중개사 N곳" 표시를 누르면 연락할 사무소를 고를 수 있습니다.
`,
  ),
  notice(
    'n05',
    '베타 서비스를 시작합니다',
    '2026-07-01T09:00:00+09:00',
    2210,
    `
순천 지역 공인중개사들과 함께 만드는 공동중개 부동산 서비스의 베타 운영을 시작합니다.

## 지금 이용할 수 있는 기능
- 아파트·분양권, 원룸·투룸 지도 검색
- 단지 실거래가와 시세 추이
- 내놓기·구하기 요청
`,
  ),
];

// ---------- FAQ ----------

export interface MockFaq {
  id: string;
  category: 'GENERAL' | 'ACCOUNT' | 'LISTING' | 'AGENCY' | 'DEAL_REQUEST' | 'AD';
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
}

const faq = (
  key: string,
  category: MockFaq['category'],
  sortOrder: number,
  question: string,
  answer: string,
  isPublished = true,
): MockFaq => ({
  id: mockUuid(`faq-${key}`),
  category,
  question,
  answer: answer.trim(),
  sortOrder,
  isPublished,
  updatedAt: '2026-11-12T10:00:00+09:00',
});

export const FAQS: MockFaq[] = [
  faq(
    'g1',
    'GENERAL',
    1,
    '어떤 지역의 매물을 볼 수 있나요?',
    '전라남도 순천시 전 지역의 아파트·분양권, 원룸·투룸, 주택, 상업·업무, 토지 매물을 볼 수 있습니다.',
  ),
  faq(
    'g2',
    'GENERAL',
    2,
    '공동중개가 무엇인가요?',
    '하나의 매물을 여러 중개사무소가 함께 중개하는 방식입니다. 같은 매물은 1건으로 묶어 보여 드리고, 연락할 사무소를 직접 고를 수 있습니다.',
  ),
  faq(
    'g3',
    'GENERAL',
    3,
    '실거래가는 언제 갱신되나요?',
    `
국토교통부 실거래가 공개시스템 자료를 매월 초에 반영합니다.

- 매매: 계약일로부터 30일 안에 신고된 거래
- 전월세: 확정일자 또는 임대차 신고가 된 계약
`,
  ),
  faq(
    'a1',
    'ACCOUNT',
    1,
    '회원 가입은 어떻게 하나요?',
    '카카오, 네이버, Google 계정으로 간편하게 가입할 수 있습니다. 휴대폰 본인 인증은 요구하지 않습니다.',
  ),
  faq(
    'a2',
    'ACCOUNT',
    2,
    '탈퇴하면 정보는 어떻게 되나요?',
    '탈퇴 즉시 로그인할 수 없게 되고, 개인정보는 30일 동안 분리 보관한 뒤 파기합니다.',
  ),
  faq(
    'a3',
    'ACCOUNT',
    3,
    '연락처를 꼭 입력해야 하나요?',
    '내놓기·구하기 요청을 등록할 때만 필요합니다. 연락처는 제안을 수락한 중개사무소에만 전달됩니다.',
  ),
  faq(
    'l1',
    'LISTING',
    1,
    '"실매물 확인" 표시는 무엇인가요?',
    '중개사무소가 최근에 매물이 유효한지 다시 확인한 날짜입니다. 확인한 지 오래된 매물은 목록 아래쪽에 표시됩니다.',
  ),
  faq(
    'l2',
    'LISTING',
    2,
    '허위매물을 발견하면 어떻게 하나요?',
    `
매물 상세 화면의 "허위매물 신고"로 알려 주세요.

1. 신고 사유를 고릅니다.
2. 확인한 내용을 적습니다.
3. 운영팀이 영업일 기준 2일 안에 결과를 알려 드립니다.
`,
  ),
  faq(
    'l3',
    'LISTING',
    3,
    '분양권 프리미엄(P)은 어떻게 계산하나요?',
    '매도 희망가에서 분양가(옵션 포함)를 뺀 금액입니다. 플러스는 빨간색, 마이너스는 파란색으로 표시합니다.',
  ),
  faq(
    'b1',
    'AGENCY',
    1,
    '중개사무소 회원으로 가입하려면 어떤 서류가 필요한가요?',
    `
- 중개사무소 등록증
- 사업자등록증
- 공제증서 또는 보증보험 증권

제출한 서류는 승인 심사에만 쓰이며 외부에 공개되지 않습니다.
`,
  ),
  faq(
    'b2',
    'AGENCY',
    2,
    '소속공인중개사·중개보조원도 매물을 올릴 수 있나요?',
    '대표가 초대한 소속 직원은 사무소 이름으로 매물을 올릴 수 있습니다. 대표가 언제든 권한을 회수할 수 있습니다.',
  ),
  faq(
    'd1',
    'DEAL_REQUEST',
    1,
    '내놓기 요청을 하면 내 연락처가 공개되나요?',
    '아니요. 중개사무소의 제안을 수락하기 전까지는 연락처가 전달되지 않습니다.',
  ),
  faq(
    'd2',
    'DEAL_REQUEST',
    2,
    '구하기 요청은 몇 곳의 중개사무소에 전달되나요?',
    '고른 지역을 담당하는 중개사무소에 전달됩니다. 예를 들어 신대지구 매매 요청은 신대·선월 지역 사무소 12곳에 전달됩니다.',
  ),
  faq(
    'ad1',
    'AD',
    1,
    '배너 광고는 어떻게 신청하나요?',
    '고객센터로 문의해 주세요. 메인 배너, 지도 광고 카드, 매물 상세 사이드 광고를 운영하고 있습니다.',
  ),
  faq(
    'ad2',
    'AD',
    2,
    '광고 성과는 어디서 확인하나요?',
    '광고 기간이 끝나면 노출 수와 클릭 수를 정리해 보내 드립니다.',
    false,
  ),
];

// ---------- 동네TV ----------

export interface MockVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  description: string | null;
  regionCode: string | null;
  complexId: string | null;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

const video = (
  key: string,
  ytId: string,
  title: string,
  at: string,
  description: string,
  extra: Partial<MockVideo> = {},
): MockVideo => ({
  id: mockUuid(`video-${key}`),
  title,
  youtubeUrl: `https://www.youtube.com/watch?v=${ytId}`,
  youtubeVideoId: ytId,
  // Fictional ids have no real still — the mock serves a drawn thumbnail instead.
  thumbnailUrl: `/mock-api/v1/admin/videos/thumb/${key}`,
  description,
  regionCode: null,
  complexId: null,
  sortOrder: Number(key.slice(1)),
  isPublished: true,
  publishedAt: at,
  updatedAt: at,
  ...extra,
});

export const VIDEOS: MockVideo[] = [
  video(
    'V01',
    'sc0SinDae34',
    '신대지구 34평, 지금 사도 될까? 2026 하반기 시세 점검',
    '2026-11-19T18:00:00+09:00',
    '신대 레이크파크 1·3단지 34평 실거래가 흐름과 전세가율을 짚어 봅니다.',
    { complexId: mockUuid('C01'), regionCode: '4615033028' },
  ),
  video(
    'V02',
    'sc0YeonHy02',
    '연향들 도시개발사업 토지 분양, 일정과 위치 핵심 정리',
    '2026-11-14T18:00:00+09:00',
    '2025년 12월 시작된 토지 분양 일정과 구역별 위치를 5분으로 정리했습니다.',
    { regionCode: '4615012100' },
  ),
  video(
    'V03',
    'sc0OcheonV3',
    '오천지구 vs 선월지구, 아이 키우는 집 실거주 비교',
    '2026-11-07T18:00:00+09:00',
    '학군, 공원, 상권, 출퇴근 동선을 기준으로 두 지구를 비교합니다.',
  ),
  video(
    'V04',
    'sc0OneRoom4',
    '순천 원룸 월세, 순천대·청암대·제일대 앞 시세 지도',
    '2026-10-30T18:00:00+09:00',
    '대학가 세 곳의 원룸·투룸 월세 시세를 지도와 함께 살펴봅니다.',
    { regionCode: '4615011000' },
  ),
  video(
    'V05',
    'sc0SeonWol5',
    '선월 하이츠 2차 분양권, 프리미엄 흐름과 입주 일정',
    '2026-10-22T18:00:00+09:00',
    '2027년 3월 입주를 앞둔 선월 하이츠 2차의 평형별 프리미엄을 정리했습니다.',
    { complexId: mockUuid('C03'), regionCode: '4615033029' },
  ),
  video(
    'V06',
    'sc0JoryeLk6',
    '조례호수공원 산책로 한 바퀴, 주변 단지 둘러보기',
    '2026-10-12T18:00:00+09:00',
    '호수공원을 따라 걸으며 조례 호수마을과 주변 단지를 소개합니다.',
    { isPublished: false, publishedAt: null },
  ),
];

/** Thumbnail art per fixture video (drawn by the mock thumb route). */
export const VIDEO_THUMBS: Record<string, { tone: string; tag: string; lines: [string, string] }> =
  {
    V01: { tone: '#0a1222', tag: '시세 점검', lines: ['신대 34평,', '지금 사도 될까?'] },
    V02: { tone: '#1d4ff2', tag: '개발 소식', lines: ['연향들 토지 분양', '핵심만 5분 정리'] },
    V03: { tone: '#7a5c14', tag: '동네 비교', lines: ['오천 vs 선월', '실거주 비교'] },
    V04: { tone: '#1b2740', tag: '원룸', lines: ['대학가 원룸', '월세 시세 지도'] },
    V05: { tone: '#4a26a8', tag: '분양권', lines: ['선월 하이츠 2차', '프리미엄 흐름'] },
    V06: { tone: '#06664a', tag: '생활', lines: ['조례호수공원', '산책로 한 바퀴'] },
  };

// ---------- 약관 ----------

export interface MockTerms {
  id: string;
  type: 'SERVICE' | 'PRIVACY' | 'LOCATION' | 'MARKETING';
  version: string;
  title: string;
  content: string;
  isRequired: boolean;
  effectiveAt: string;
  publishedAt: string | null;
  consentCount: number | null;
  createdAt: string;
  updatedAt: string;
}

const NOTE =
  '※ 이 문서는 화면 개발용 예시입니다. 실제 약관은 서비스 오픈 전에 운영자가 관리자 화면에서 등록합니다.';

const terms = (
  type: MockTerms['type'],
  version: string,
  title: string,
  isRequired: boolean,
  effectiveAt: string,
  publishedAt: string | null,
  consentCount: number | null,
  paragraphs: string[],
): MockTerms => ({
  id: mockUuid(`terms-${type.toLowerCase()}-${version}`),
  type,
  version,
  title,
  content: [NOTE, ...paragraphs].join('\n\n'),
  isRequired,
  effectiveAt,
  publishedAt,
  consentCount,
  createdAt: publishedAt ?? '2026-11-20T10:00:00+09:00',
  updatedAt: publishedAt ?? '2026-11-21T16:40:00+09:00',
});

const SERVICE_BODY = [
  '제1조 (목적)\n이 약관은 회사가 제공하는 순천 지역 부동산 공동중개 정보 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무 및 책임 사항을 정하는 것을 목적으로 합니다.',
  '제2조 (서비스의 내용)\n① 회사는 개업공인중개사가 등록한 매물 정보를 지도와 목록으로 제공합니다.\n② 회사는 통신판매중개자로서 거래 당사자가 아니며, 매물 정보의 정확성은 이를 등록한 중개사무소가 책임집니다.\n③ 회원은 내놓기·구하기 요청을 등록해 지역 중개사무소의 제안을 받을 수 있습니다.',
  '제3조 (회원 가입)\n① 회원 가입은 카카오·네이버·Google 간편 로그인으로 진행하며, 필수 약관에 동의하면 완료됩니다.\n② 회사는 휴대폰 본인 인증을 요구하지 않습니다. 연락처는 회원이 직접 입력하는 일반 정보입니다.',
  '제4조 (회원의 의무)\n회원은 허위 정보를 등록하거나 타인의 정보를 도용해서는 안 되며, 허위 매물을 발견하면 신고 기능으로 알릴 수 있습니다.',
  '제5조 (회원 탈퇴)\n회원은 언제든지 계정 설정에서 탈퇴할 수 있으며, 회사는 관련 법령이 정한 기간이 지나면 개인정보를 지체 없이 파기합니다.',
];

export const TERMS: MockTerms[] = [
  terms('SERVICE', '1.1', '이용약관', true, '2026-12-15T00:00:00+09:00', null, null, [
    ...SERVICE_BODY,
    '제6조 (허위매물에 대한 조치)\n① 회사는 허위매물 신고가 사실로 확인되면 해당 매물을 숨기고 중개사무소에 경고할 수 있습니다.\n② 경고가 3회 누적된 중개사무소는 이용이 제한될 수 있습니다.',
    '부칙\n이 약관은 2026년 12월 15일부터 적용합니다.',
  ]),
  terms(
    'SERVICE',
    '1.0',
    '이용약관',
    true,
    '2026-10-01T00:00:00+09:00',
    '2026-08-10T09:00:00+09:00',
    4812,
    [...SERVICE_BODY, '부칙\n이 약관은 2026년 10월 1일부터 적용합니다.'],
  ),
  terms(
    'PRIVACY',
    '1.1',
    '개인정보처리방침',
    true,
    '2026-11-01T00:00:00+09:00',
    '2026-10-23T10:00:00+09:00',
    4655,
    [
      '## 1. 수집 항목\n- 필수: 간편 로그인 식별값, 닉네임\n- 선택: 이름, 이메일, 연락처(간편 로그인 제공 동의 시 또는 직접 입력 시)',
      '## 2. 수집·이용 목적\n회원 식별과 로그인 유지, 내놓기·구하기 요청 전달, 관심 매물·단지 알림, 고객 문의 응대',
      '## 3. 보유 기간\n회원 탈퇴 시까지 보유하며, 탈퇴 후에는 분쟁 대응을 위해 30일간 분리 보관한 뒤 파기합니다.',
      '## 4. 개인정보보호책임자\n사이트 설정의 사업자 정보에 등록된 개인정보보호책임자에게 문의할 수 있습니다.',
    ],
  ),
  terms(
    'PRIVACY',
    '1.0',
    '개인정보처리방침',
    true,
    '2026-10-01T00:00:00+09:00',
    '2026-08-10T09:00:00+09:00',
    3120,
    [
      '## 1. 수집 항목\n간편 로그인 식별값, 닉네임, 이름, 이메일, 연락처',
      '## 2. 수집·이용 목적\n회원 식별과 로그인 유지, 내놓기·구하기 요청 전달, 고객 문의 응대',
      '## 3. 보유 기간\n회원 탈퇴 시까지',
    ],
  ),
  terms(
    'LOCATION',
    '1.0',
    '위치기반서비스 이용약관',
    false,
    '2026-10-01T00:00:00+09:00',
    '2026-08-10T09:00:00+09:00',
    2984,
    [
      '제1조 (목적)\n이 약관은 회사가 제공하는 위치기반서비스(내 주변 매물 보기)의 이용 조건을 정합니다.',
      '제2조 (위치정보의 이용)\n회사는 회원이 "내 위치" 버튼을 누른 때에만 기기의 위치정보를 이용하며, 서버에 저장하지 않습니다.',
    ],
  ),
  terms(
    'MARKETING',
    '1.0',
    '마케팅 정보 수신 동의',
    false,
    '2026-10-01T00:00:00+09:00',
    '2026-08-10T09:00:00+09:00',
    1876,
    [
      '## 수신 내용\n- 관심 지역의 새 분양 소식\n- 이벤트와 혜택 안내',
      '## 수신 방법\n앱 알림, 이메일. 동의는 MY > 설정에서 언제든 철회할 수 있습니다.',
    ],
  ),
];
