import { TermsType } from '@house/shared';
import type { TermsDocument } from '../api';

/** Display order of the consent rows (design: 이용약관 → 개인정보 → 위치기반 → 마케팅). */
export const TERMS_ORDER: readonly TermsType[] = [
  TermsType.SERVICE,
  TermsType.PRIVACY,
  TermsType.LOCATION,
  TermsType.MARKETING,
];

/** Row copy per terms type (the signup screen says "개인정보 수집·이용", not the document title). */
export const CONSENT_COPY: Record<TermsType, { label: string; hint?: string }> = {
  SERVICE: { label: '이용약관' },
  PRIVACY: { label: '개인정보 수집·이용', hint: '이름, 연락처, 간편 로그인 식별값' },
  LOCATION: { label: '위치기반서비스 이용약관', hint: '내 주변 매물·중개사무소 찾기에 사용' },
  MARKETING: {
    label: '마케팅 정보 수신',
    hint: '새 분양 소식, 이벤트 안내 · 동의하지 않아도 가입할 수 있어요',
  },
  // Purpose consents (D8): given with one submission, never on the signup screen.
  PRIVACY_AGENCY_APPLICATION: { label: '중개사무소 등록 신청 개인정보 수집·이용' },
  PRIVACY_AGENCY_JOIN: { label: '소속 중개사 합류 개인정보 수집·이용' },
  DEAL_REQUEST_PRIVACY: { label: '내놓기·구하기 개인정보 수집·이용' },
  DEAL_REQUEST_PROVIDE: { label: '개인정보 제3자(중개사무소) 제공' },
};

export type ConsentState = Partial<Record<TermsType, boolean>>;

/** Current documents sorted in display order (unknown future types keep their relative order at the end). */
export function sortTerms(docs: readonly TermsDocument[]): TermsDocument[] {
  const rank = (t: TermsType) => {
    const i = TERMS_ORDER.indexOf(t);
    return i === -1 ? TERMS_ORDER.length : i;
  };
  return [...docs].sort((a, b) => rank(a.type) - rank(b.type));
}

export function countTerms(docs: readonly TermsDocument[]): { required: number; optional: number } {
  const required = docs.filter((d) => d.isRequired).length;
  return { required, optional: docs.length - required };
}

/**
 * 'all' when every document is agreed, 'none' when nothing is, otherwise 'some'. `extra` are the
 * other checkboxes 전체 동의 covers (the 만 14세 이상 confirmation of the signup).
 */
export function agreeAllState(
  docs: readonly TermsDocument[],
  state: ConsentState,
  extra: readonly boolean[] = [],
): 'all' | 'some' | 'none' {
  const total = docs.length + extra.length;
  const agreed = docs.filter((d) => state[d.type]).length + extra.filter(Boolean).length;
  if (total > 0 && agreed === total) return 'all';
  return agreed === 0 ? 'none' : 'some';
}

/** 전체 동의 toggle: sets every document (required and optional) to `agreed`. */
export function setAll(docs: readonly TermsDocument[], agreed: boolean): ConsentState {
  return Object.fromEntries(docs.map((d) => [d.type, agreed]));
}

/** Required documents that are not agreed yet. */
export function missingRequired(
  docs: readonly TermsDocument[],
  state: ConsentState,
): TermsDocument[] {
  return docs.filter((d) => d.isRequired && !state[d.type]);
}

/** `consents` of a submission — one record per current document (agree or decline, versioned by id). */
export function buildConsentPayload(docs: readonly TermsDocument[], state: ConsentState) {
  return {
    consents: docs.map((d) => ({ termsDocumentId: d.id, agreed: state[d.type] === true })),
  };
}

/**
 * Body of POST /auth/signup (`signupSchema`): nickname, the 만 14세 이상 confirmation, one consent
 * record per current document and the marketing opt-in (the backend keeps it in step with the
 * MARKETING record). `phone` is left out so the backend keeps the number the provider shared.
 */
export function buildSignupPayload(
  docs: readonly TermsDocument[],
  state: ConsentState,
  nickname: string,
) {
  return {
    nickname: nickname.trim(),
    ageOver14: true as const,
    ...buildConsentPayload(docs, state),
    marketingOptIn: state[TermsType.MARKETING] === true,
  };
}

/** Body of POST /me/consents for a re-consent: the given (pending required) documents, agreed. */
export function buildReconsentPayload(docs: readonly TermsDocument[]) {
  return { consents: docs.map((d) => ({ termsDocumentId: d.id, agreed: true })) };
}

/** Public page of a terms type (the 약관 pages), for "전문 보기" links. */
export const TERMS_PAGE_SLUG: Partial<Record<TermsType, 'service' | 'privacy' | 'location'>> = {
  SERVICE: 'service',
  PRIVACY: 'privacy',
  LOCATION: 'location',
};
