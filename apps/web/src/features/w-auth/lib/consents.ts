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

/** 'all' when every document is agreed, 'none' when nothing is, otherwise 'some'. */
export function agreeAllState(
  docs: readonly TermsDocument[],
  state: ConsentState,
): 'all' | 'some' | 'none' {
  const agreed = docs.filter((d) => state[d.type]).length;
  if (docs.length > 0 && agreed === docs.length) return 'all';
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

/** Body of POST /me/consents — one record per current document (agree or decline, versioned by id). */
export function buildConsentPayload(docs: readonly TermsDocument[], state: ConsentState) {
  return {
    consents: docs.map((d) => ({ termsDocumentId: d.id, agreed: state[d.type] === true })),
  };
}
