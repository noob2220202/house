import { mockUuid } from '@/lib/mock';

/**
 * Current terms documents (fictional placeholder text — the real documents are written by the
 * operator in the admin 약관 관리 screen). Shape = termsDocumentSchema in src/features/w-auth/api.ts,
 * mirroring the TermsDocument model (apps/api/prisma/schema/auth.prisma).
 * Owned by the w-auth page group; other groups may add sub-routes (e.g. version history) next to it.
 */
export interface MockTermsDocument {
  id: string;
  type: 'SERVICE' | 'PRIVACY' | 'LOCATION' | 'MARKETING';
  version: string;
  title: string;
  isRequired: boolean;
  effectiveAt: string;
  content: string;
}

const NOTICE =
  '※ 이 문서는 화면 개발용 예시입니다. 실제 약관은 서비스 오픈 전에 운영자가 관리자 화면에서 등록합니다.';

export const MOCK_TERMS: readonly MockTermsDocument[] = [
  {
    id: mockUuid('terms-service-1.0'),
    type: 'SERVICE',
    version: '1.0',
    title: '이용약관',
    isRequired: true,
    effectiveAt: '2026-10-01T00:00:00+09:00',
    content: [
      NOTICE,
      '제1조 (목적)\n이 약관은 회사가 제공하는 순천 지역 부동산 공동중개 정보 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무 및 책임 사항을 정하는 것을 목적으로 합니다.',
      '제2조 (서비스의 내용)\n① 회사는 개업공인중개사가 등록한 매물 정보를 지도와 목록으로 제공합니다.\n② 회사는 통신판매중개자로서 거래 당사자가 아니며, 매물 정보의 정확성은 이를 등록한 중개사무소가 책임집니다.\n③ 회원은 내놓기·구하기 요청을 등록해 지역 중개사무소의 제안을 받을 수 있습니다.',
      '제3조 (회원 가입)\n① 회원 가입은 카카오·네이버·Google 간편 로그인으로 진행하며, 필수 약관에 동의하면 완료됩니다.\n② 회사는 휴대폰 본인 인증을 요구하지 않습니다. 연락처는 회원이 직접 입력하는 일반 정보입니다.',
      '제4조 (회원의 의무)\n회원은 허위 정보를 등록하거나 타인의 정보를 도용해서는 안 되며, 허위 매물을 발견하면 신고 기능으로 알릴 수 있습니다.',
      '제5조 (회원 탈퇴)\n회원은 언제든지 계정 설정에서 탈퇴할 수 있으며, 회사는 관련 법령이 정한 기간이 지나면 개인정보를 지체 없이 파기합니다.',
    ].join('\n\n'),
  },
  {
    id: mockUuid('terms-privacy-1.1'),
    type: 'PRIVACY',
    version: '1.1',
    title: '개인정보 수집·이용 동의',
    isRequired: true,
    effectiveAt: '2026-11-01T00:00:00+09:00',
    content: [
      NOTICE,
      '1. 수집 항목\n· 필수: 간편 로그인 식별값, 닉네임\n· 선택: 이름, 이메일, 연락처(간편 로그인 제공 동의 시 또는 직접 입력 시)',
      '2. 수집·이용 목적\n회원 식별과 로그인 유지, 내놓기·구하기 요청 전달, 관심 매물·단지 알림, 고객 문의 응대',
      '3. 보유 기간\n회원 탈퇴 시까지 보유하며, 탈퇴 후에는 분쟁 대응을 위해 30일간 분리 보관한 뒤 파기합니다. 관련 법령에 따라 보존해야 하는 정보는 해당 기간 동안 보관합니다.',
      '4. 동의를 거부할 권리\n동의를 거부할 수 있으나, 필수 항목 수집에 동의하지 않으면 회원 가입을 할 수 없습니다.',
    ].join('\n\n'),
  },
  {
    id: mockUuid('terms-location-1.0'),
    type: 'LOCATION',
    version: '1.0',
    title: '위치기반서비스 이용약관',
    isRequired: true,
    effectiveAt: '2026-10-01T00:00:00+09:00',
    content: [
      NOTICE,
      '제1조 (목적)\n이 약관은 회사가 제공하는 위치기반서비스의 이용과 관련해 회사와 회원의 권리·의무를 정합니다.',
      '제2조 (서비스 내용)\n회원이 "내 위치" 기능을 사용할 때에만 단말기의 위치 정보를 이용해 주변 매물과 중개사무소를 지도에 표시합니다.',
      '제3조 (위치 정보의 보관)\n회사는 회원의 위치 정보를 서버에 저장하지 않으며, 지도 표시가 끝나면 즉시 폐기합니다.',
      '제4조 (회원의 권리)\n회원은 브라우저 또는 단말기 설정에서 언제든지 위치 정보 제공을 중단할 수 있습니다.',
    ].join('\n\n'),
  },
  {
    id: mockUuid('terms-marketing-1.0'),
    type: 'MARKETING',
    version: '1.0',
    title: '마케팅 정보 수신 동의',
    isRequired: false,
    effectiveAt: '2026-10-01T00:00:00+09:00',
    content: [
      NOTICE,
      '1. 수신 내용\n새 분양 소식, 지역 부동산 소식, 이벤트 및 혜택 안내',
      '2. 수신 방법\n서비스 내 알림과 이메일로 보내 드립니다. 문자 메시지는 발송하지 않습니다.',
      '3. 철회\n동의하지 않아도 서비스를 이용할 수 있으며, 마이페이지 > 내 정보에서 언제든지 철회할 수 있습니다.',
      '관심 단지·관심 지역의 새 매물 알림은 서비스 알림이므로 마케팅 수신 동의와 상관없이 받을 수 있습니다.',
    ].join('\n\n'),
  },
];
