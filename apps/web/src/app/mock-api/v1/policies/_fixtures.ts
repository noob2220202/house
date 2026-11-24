/**
 * Operating policies (ASSUMED endpoint GET /policies/:slug) — fictional example text for screen
 * development only. The real 허위매물 신고 정책 (criteria, sanctions, response times) is written and
 * published by the operator in the back-office; nothing of it ships in the frontend bundle.
 */
export interface MockPolicyDocument {
  slug: string;
  title: string;
  version: string;
  effectiveAt: string;
  content: string;
}

export const MOCK_POLICIES: readonly MockPolicyDocument[] = [
  {
    slug: 'false-listing',
    title: '허위매물 신고 정책',
    version: '1.0',
    effectiveAt: '2026-10-01T00:00:00+09:00',
    content: `
※ 이 문서는 화면 개발용 예시입니다. 실제 정책은 서비스 오픈 전에 운영자가 관리자 화면에서 등록합니다.

## 허위매물이란
- 실제로 없거나, 이미 거래가 끝났는데 계속 올라와 있는 매물
- 가격, 면적, 층, 방향 등 중요한 정보가 사실과 다른 매물
- 다른 집의 사진을 쓰거나 실제와 크게 다른 사진을 올린 매물
- 소유자가 중개를 맡긴 적이 없는 매물

## 신고하는 방법
1. 매물 상세 화면의 "허위매물 신고"를 누릅니다. 로그인한 회원만 신고할 수 있어요.
2. 신고 사유를 고르고 확인한 내용을 적습니다.
3. 처리 결과는 MY > 알림으로 알려 드립니다.

## 처리 절차
1. 접수: 신고가 들어오면 운영팀에 전달됩니다.
2. 확인: 해당 중개사무소에 사실 확인을 요청합니다.
3. 조치: 허위로 확인되면 매물을 숨기고 중개사무소에 경고합니다.
4. 안내: 처리 결과를 신고하신 분께 알림으로 알려 드립니다.

## 신고자 보호
신고하신 분의 정보는 중개사무소에 전달하지 않습니다.
`.trim(),
  },
];
