/** One-tap reason texts for the decision dialogs (editable after tapping). */
export const AGENCY_REJECT_PRESETS = [
  '등록번호가 국가공간정보 조회 결과와 일치하지 않습니다.',
  '중개사무소 등록증 또는 사업자등록증이 제출되지 않았습니다.',
  '제출한 서류가 흐리거나 잘려 내용을 확인할 수 없습니다.',
  '대표자 이름이 등록 정보와 다릅니다.',
  '휴업 또는 폐업 상태의 중개사무소입니다.',
] as const;

/** How an admin verified an application the automatic checks could not (approval override). */
export const AGENCY_APPROVE_OVERRIDE_PRESETS = [
  '중개사무소 등록증 원본을 직접 확인했습니다.',
  '관할 시·군·구청 중개업 등록 담당자에게 전화로 확인했습니다.',
  '등록 조회 서비스 장애로 등록증과 사업자등록증을 대조해 확인했습니다.',
  '소재지 표기만 다르고 같은 주소임을 확인했습니다.',
] as const;

export const AGENCY_SUSPEND_PRESETS = [
  '허위매물 신고가 사실로 확인되어 경고가 3회 누적되었습니다.',
  '중개사무소 등록이 취소되거나 폐업한 것으로 확인되었습니다.',
  '다른 사무소의 등록 정보를 도용한 것으로 확인되었습니다.',
] as const;

export const LISTING_HIDE_PRESETS = [
  '이미 거래가 끝난 매물입니다.',
  '실제와 다른 가격으로 광고했습니다.',
  '실제 매물과 다른 사진을 사용했습니다.',
  '존재하지 않는 매물로 확인되었습니다.',
  '표시·광고 명시사항이 빠져 있습니다.',
] as const;

export const LISTING_CLOSE_PRESETS = [
  '실거래 신고로 거래 완료가 확인되었습니다.',
  '소유자가 광고 중단을 요청했습니다.',
  '중개사무소가 이용 정지되어 광고를 종료합니다.',
] as const;

export const REPORT_REJECT_PRESETS = [
  '확인 결과 광고 내용이 사실과 같습니다.',
  '공동중개 매물로 중복 등록이 아닙니다.',
  '신고 내용만으로는 사실 여부를 확인할 수 없습니다.',
] as const;

export const REPORT_RESOLVE_PRESETS = [
  '소유자 확인 결과 신고 내용이 사실입니다.',
  '실거래 신고 내역과 일치합니다.',
  '현장 확인 결과 광고 내용과 다릅니다.',
] as const;

export const DEAL_REQUEST_SPAM_PRESETS = [
  '광고·홍보 목적의 글입니다.',
  '같은 내용을 반복해서 등록했습니다.',
  '외부 연락처로 유도하는 문구가 포함되어 있습니다.',
  '실제 거래 의사가 없는 것으로 보입니다.',
] as const;

export const DEAL_REQUEST_CLOSE_PRESETS = [
  '스팸으로 확인되어 종료합니다.',
  '요청자가 고객센터로 종료를 요청했습니다.',
  '부적절한 내용이 포함되어 있습니다.',
] as const;

export const USER_SUSPEND_PRESETS = [
  '스팸성 요청을 반복해서 등록했습니다.',
  '허위 신고를 반복해서 접수했습니다.',
  '다른 이용자에게 욕설·비방을 했습니다.',
  '타인의 정보를 도용한 것으로 확인되었습니다.',
] as const;
