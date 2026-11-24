import { mockUuid } from '@/lib/mock';
import { MOCK_TERMS, type MockTermsDocument } from '../../_fixtures';

/**
 * Version history of the terms documents (w-content: /terms/[type] version selector).
 * The CURRENT version of every type is the w-auth fixture (`MOCK_TERMS`, served by GET /terms/:type);
 * this file only adds the superseded versions, so both groups always agree on what is in force.
 * All wording is fictional sample text, not legal advice. `[상호]` brackets are operator placeholders.
 */
type TermsType = MockTermsDocument['type'];

const archived = (
  type: TermsType,
  version: string,
  title: string,
  effectiveAt: string,
  content: string,
): MockTermsDocument => ({
  id: mockUuid(`terms-${type.toLowerCase()}-${version}`),
  type,
  version,
  title,
  isRequired: true,
  effectiveAt,
  content: content.trim(),
});

const SERVICE_V09 = `
제1조 (목적)
이 약관은 [상호](이하 "회사")가 운영하는 순천 지역 부동산 공동중개 서비스(이하 "서비스")를 이용할 때 회사와 회원의 권리, 의무와 책임, 그 밖에 필요한 사항을 정하는 것을 목적으로 합니다.

제2조 (용어의 뜻)
1. "서비스"란 회사가 웹사이트와 모바일 화면으로 제공하는 매물 정보, 지도 검색, 내놓기·구하기, 중개사무소 찾기와 이에 딸린 모든 기능을 말합니다.
2. "회원"이란 이 약관에 동의하고 카카오, 네이버, Google 계정으로 가입해 서비스를 이용하는 사람을 말합니다.
3. "중개사 회원"이란 개업공인중개사 또는 소속 공인중개사로서 회사의 승인을 받아 매물을 등록하는 회원을 말합니다.
4. "공동중개 매물"이란 여러 중개사무소가 함께 올린 같은 매물을 하나로 묶어 보여주는 매물을 말합니다.

제3조 (약관의 효력과 변경)
1. 이 약관은 서비스 화면에 게시하거나 그 밖의 방법으로 알림으로써 효력이 생깁니다.
2. 회사는 관련 법령을 어기지 않는 범위에서 약관을 바꿀 수 있고, 바꾸는 경우 적용일 7일 전부터 공지사항에 알립니다. 회원에게 불리한 변경은 30일 전에 알립니다.
3. 회원이 바뀐 약관에 동의하지 않으면 이용계약을 해지할 수 있습니다.

제4조 (회원가입과 계정)
1. 회원가입은 카카오, 네이버, Google 가운데 하나의 계정으로 로그인하고 필수 약관에 동의하면 끝납니다.
2. 회사는 휴대전화 본인확인이나 문자 인증을 요구하지 않습니다. 연락처는 회원이 직접 입력한 값으로만 쓰입니다.
3. 회원은 자신의 계정을 다른 사람이 쓰게 해서는 안 됩니다.

제5조 (서비스의 내용)
1. 회사는 중개사 회원이 등록한 매물 정보를 지도와 목록으로 제공합니다.
2. 회사는 통신판매중개자로서 거래 당사자가 아니며, 매물의 거래 조건과 계약은 회원과 중개사무소가 직접 정합니다.
3. 실매물 확인 날짜는 중개사 회원이 현장 또는 소유자 확인을 마친 날을 뜻합니다.

제6조 (내놓기·구하기)
1. 회원은 팔거나 세놓을 집, 구하는 조건을 남겨 지역 중개사무소의 제안을 받을 수 있습니다.
2. 회원의 연락처는 회원이 동의한 중개사무소에만 전달됩니다.

제7조 (회원의 의무)
회원은 다음 행위를 해서는 안 됩니다.
- 사실과 다른 정보를 등록하거나 다른 사람의 정보를 도용하는 행위
- 허위매물, 이미 거래된 매물을 계속 올려 두는 행위
- 서비스의 정보를 회사의 동의 없이 수집, 복제, 배포하는 행위
- 그 밖에 법령이나 공공질서에 어긋나는 행위

제8조 (허위매물 신고와 조치)
1. 누구나 사실과 다른 매물을 신고할 수 있고, 회사는 확인을 거쳐 매물을 숨기거나 중개사 회원에게 경고할 수 있습니다.
2. 조치 기준은 허위매물 신고 정책에서 따로 정합니다.

제9조 (이용계약의 해지)
1. 회원은 언제든지 MY 메뉴에서 탈퇴할 수 있습니다.
2. 회사는 회원이 이 약관을 어긴 경우 미리 알린 뒤 이용을 제한하거나 계약을 해지할 수 있습니다.

제10조 (책임의 제한)
1. 회사는 천재지변, 통신 장애처럼 회사가 막을 수 없는 사유로 서비스를 제공하지 못한 경우 책임을 지지 않습니다.
2. 회사는 중개사 회원이 등록한 정보의 정확성을 보증하지 않습니다. 다만 신고가 접수되면 지체 없이 확인합니다.

제11조 (분쟁의 해결)
이 약관과 관련한 분쟁은 대한민국 법을 따르고, 소송은 민사소송법에 따른 관할 법원에 냅니다.

부칙
이 약관은 2026년 7월 1일부터 적용합니다.
`;

const SERVICE_V08 = SERVICE_V09.replace(
  /제8조 \(허위매물 신고와 조치\)[\s\S]*?제9조/,
  '제8조 (허위매물 신고)\n누구나 사실과 다른 매물을 신고할 수 있고, 회사는 확인을 거쳐 필요한 조치를 합니다.\n\n제9조',
).replace('2026년 7월 1일', '2026년 3월 2일');

const PRIVACY_V10 = `
[상호](이하 "회사")는 개인정보 보호법을 지키며, 이용자의 개인정보를 어떻게 다루는지 아래와 같이 알립니다.

제1조 (수집하는 개인정보)
회사는 서비스 제공에 꼭 필요한 정보만 모읍니다.
- 회원가입: 소셜 로그인(카카오, 네이버, Google) 식별값, 닉네임, 이메일(제공에 동의한 경우)
- 내놓기·구하기: 연락처, 매물 주소 또는 희망 지역, 희망 가격
- 중개사 회원: 상호, 대표자 이름, 중개사무소 등록번호, 사무소 주소와 전화번호
- 자동 수집: 접속 기록, 쿠키, 기기 정보
회사는 주민등록번호를 모으지 않고, 휴대전화 본인확인이나 문자 인증을 하지 않습니다.

제2조 (이용 목적)
1. 회원 식별과 로그인 유지
2. 매물 문의, 내놓기·구하기 요청을 중개사무소에 전달
3. 허위매물 신고 처리와 서비스 부정 이용 방지
4. 관심 단지 알림 등 회원이 고른 알림 발송

제3조 (보유 기간)
1. 회원 정보는 탈퇴할 때까지 보관하고, 탈퇴 후 30일이 지나면 지웁니다.
2. 관계 법령에 따라 보관해야 하는 기록은 정해진 기간 동안 따로 보관합니다.
- 계약 또는 청약철회 기록: 5년
- 소비자 불만 또는 분쟁 처리 기록: 3년

제4조 (제3자 제공)
회사는 이용자가 동의한 경우에만 개인정보를 제3자에게 제공합니다. 내놓기·구하기 요청의 연락처는 이용자가 제안을 수락한 중개사무소에만 전달됩니다.

제5조 (이용자의 권리)
이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제하거나 처리 정지를 요구할 수 있습니다. MY 메뉴에서 직접 하거나 개인정보보호책임자에게 연락하면 지체 없이 처리합니다.

제6조 (개인정보보호책임자)
- 책임자: [개인정보보호책임자]
- 연락처: [대표번호], [이메일]

부칙
이 방침은 2026년 3월 2일부터 적용합니다.
`;

/** Superseded versions, newest first within a type. */
const ARCHIVED_TERMS: readonly MockTermsDocument[] = [
  archived('SERVICE', '0.9', '이용약관', '2026-07-01T00:00:00+09:00', SERVICE_V09),
  archived('SERVICE', '0.8', '이용약관', '2026-03-02T00:00:00+09:00', SERVICE_V08),
  archived('PRIVACY', '1.0', '개인정보처리방침', '2026-03-02T00:00:00+09:00', PRIVACY_V10),
];

/** "service" | "SERVICE" → the enum value the API uses, or null. */
export function termsTypeOf(param: string): TermsType | null {
  const upper = param.toUpperCase();
  return MOCK_TERMS.some((d) => d.type === upper) ? (upper as TermsType) : null;
}

/** Every published version of a type, newest first; the first one is the version in force. */
export function versionsOf(type: TermsType): MockTermsDocument[] {
  return [...MOCK_TERMS, ...ARCHIVED_TERMS]
    .filter((d) => d.type === type)
    .sort((a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt));
}

export const currentIdOf = (type: TermsType): string | undefined =>
  MOCK_TERMS.find((d) => d.type === type)?.id;
