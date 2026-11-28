import type { TermsType } from '@house/shared';
import { mockUuid } from '@/lib/mock';

/**
 * Current terms documents (fictional placeholder text — the real documents are written by the
 * operator in the admin 약관 관리 screen). Shape = termsDocumentSchema in src/features/w-auth/api.ts,
 * mirroring the TermsDocument model (apps/api/prisma/schema/auth.prisma).
 * Owned by the w-auth page group; other groups may add sub-routes (e.g. version history) next to it.
 */
export interface MockTermsDocument {
  id: string;
  type: TermsType;
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
    isRequired: false,
    effectiveAt: '2026-10-01T00:00:00+09:00',
    content: [
      NOTICE,
      '제1조 (목적)\n이 약관은 회사가 제공하는 위치기반서비스의 이용과 관련해 회사와 회원의 권리·의무를 정합니다.',
      '제2조 (서비스 내용)\n이 약관에 동의하고 "내 위치" 버튼을 누를 때에만 단말기의 현재 위치를 확인해, 지도를 약 500m 단위로 어림한 위치로 옮깁니다.',
      '제3조 (위치 정보의 처리)\n현재 위치는 단말기(브라우저) 안에서만 사용하며 서버로 보내거나 저장하지 않습니다. 매물·중개사무소를 불러올 때 서버와 주소창에는 어림한 지도 범위만 전달됩니다.',
      '제4조 (회원의 권리)\n동의하지 않아도 지도를 직접 움직여 모든 기능을 이용할 수 있으며, 브라우저 또는 단말기 설정에서 언제든지 위치 정보 제공을 중단할 수 있습니다.',
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

/**
 * Purpose consents (D8) — given with one submission (등록 신청, 합류, 내놓기·구하기), never on the
 * signup screen, so they are not part of MOCK_TERMS (GET /terms, /me/consents). Served by
 * GET /terms/:type like the seeded sample documents of the real API: the same text as
 * apps/api/prisma/seed/base.ts (TERMS_V1, DEAL_REQUEST_*_BODY, INQUIRY_PRIVACY_BODY) — keep them in sync. The consent
 * UI renders this text and submits its version.
 */
export const MOCK_ACTION_CONSENT_TERMS: readonly MockTermsDocument[] = (
  [
    [
      'PRIVACY_AGENCY_APPLICATION',
      '[필수] 중개사무소 등록 신청 개인정보 수집·이용 동의',
      [
        '- 수집 항목: 대표 공인중개사 성명, 연락처(대표·휴대폰), 이메일, 사무소 주소, 중개사무소 등록번호, 사업자등록번호, 제출 서류(등록증 등)',
        '- 수집·이용 목적: 중개사무소 등록 심사, 심사 결과 안내, 중개사 회원 관리',
        '- 보유·이용 기간: 회원 탈퇴 또는 등록 해지 후 5년 (반려된 신청은 반려 후 1년)',
        '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 등록 신청을 할 수 없습니다.',
      ],
    ],
    [
      'PRIVACY_AGENCY_JOIN',
      '[필수] 소속 중개사 합류 개인정보 수집·이용 동의',
      [
        '- 수집 항목: 이름, 휴대폰 번호, 직함, 공인중개사 자격 정보(대표가 확인해 입력하는 경우)',
        '- 수집·이용 목적: 소속공인중개사·중개보조원 등록, 매물 표시·광고의 명시사항 표시, 고용 신고 안내',
        '- 보유·이용 기간: 소속 해지 후 5년',
        '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 중개사무소에 합류할 수 없습니다.',
      ],
    ],
    [
      'DEAL_REQUEST_PRIVACY',
      '[필수] 내놓기·구하기 개인정보 수집·이용 동의',
      [
        '- 수집 항목: 이름, 휴대폰 번호, (내놓기) 매물 주소(도로명·동·호수)·위치·층·면적·희망 가격 등 매물 정보·사진·설명, (구하기) 희망 지역·단지·예산·면적 등 찾는 조건과 설명',
        '- 수집·이용 목적: 내놓기·구하기 요청 등록, 중개사무소 제안 전달, 요청 관리와 알림',
        '- 보유·이용 기간: 요청이 끝난 날(거래 완료·취소·기간 만료)부터 30일. 30일이 지나면 이름·휴대폰 번호·동·호수·도로명 주소·위치·층·면적·사진·설명을 파기하고, 요청 기록(요청 유형·매물 유형·거래 유형·희망 가격·읍면동·단지·찾는 조건·등록일)만 내 요청 내역에 남깁니다. 회원 탈퇴 시에는 탈퇴와 함께 같은 항목을 파기합니다.',
        '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 요청을 등록할 수 없습니다.',
      ],
    ],
    [
      'DEAL_REQUEST_PROVIDE',
      '[필수] 내놓기·구하기 개인정보 제3자(중개사무소) 제공 동의',
      [
        '- 제공받는 자: 요청의 공개 범위에 해당하는 이 서비스의 중개사무소(전체 공개: 순천시에서 승인된 모든 중개사무소, 선택 공개: 회원이 고른 중개사무소)와 이미 제안을 보낸 중개사무소',
        '- 제공 목적: 중개 제안과 상담 연락',
        '- 요청을 받은 모든 중개사무소에 제공하는 항목: (내놓기) 매물 유형·거래 유형·희망 가격·입주 가능일, 읍면동·단지명, 전용면적 구간, 약 200m 단위로 낮춘 대략적인 위치, 사진 장수, 체크한 조건(가격 협의 가능·즉시 입주 가능·입주일 협의 가능)과 단지 매물의 저/중/고층 구분, (구하기) 희망 지역·단지·예산·면적·방 수·입주 희망일과 설명',
        '- 연락처를 공개한 중개사무소에만 제공하는 항목: 이름·휴대폰 번호와 (내놓기) 도로명 주소·동·호수·정확한 위치·층·전용면적·사진·설명. 제안을 수락하면서 공개를 선택하거나 요청 상세에서 직접 공개한 중개사무소만 해당하며, 공개는 언제든 취소할 수 있습니다.',
        '- 보유·이용 기간: 요청이 끝난 날부터 30일까지. 거래 완료된 요청은 30일이 지나면, 공개를 취소하거나 요청이 취소·기간 만료·운영자 종료되면 그때부터 중개사무소에서도 연락처와 상세 정보를 볼 수 없습니다.',
        '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 요청을 등록할 수 없습니다.',
      ],
    ],
    [
      'INQUIRY_PRIVACY',
      '[필수] 문의 개인정보 수집·이용 및 제공 동의',
      [
        '- 수집 항목: 이름, 연락처(휴대폰 또는 전화번호), 문의 내용 (회원은 회원 정보와 연결되어 저장됩니다)',
        '- 수집·이용 목적: 문의 응대 — 문의를 받은 중개사무소의 답변과 연락, 문의 내역 관리',
        '- 제공받는 자: 문의를 받는 중개사무소 (제공 항목: 이름, 연락처, 문의 내용과 문의한 매물, 제공 목적: 문의 응대)',
        '- 보유·이용 기간: 마지막 답변(또는 마지막 문의) 후 1년. 그 전에 회원 탈퇴 시 즉시 파기합니다.',
        '- 동의를 거부할 권리와 불이익: 동의하지 않을 수 있으며, 동의하지 않으면 문의를 남길 수 없습니다. 전화·문자로 직접 연락하는 데에는 영향이 없습니다.',
      ],
    ],
  ] as const
).map(([type, title, lines]) => ({
  id: mockUuid(`terms-${type.toLowerCase()}-1.0`),
  type,
  version: '1.0',
  title,
  isRequired: true,
  effectiveAt: '2026-11-24T00:00:00+09:00',
  content: [NOTICE, lines.join('\n')].join('\n\n'),
}));
