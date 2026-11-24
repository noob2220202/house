import { TERMS_TYPE_LABEL, TermsType } from '@house/shared';

/**
 * Documents under /terms/[type] (all linked in the footer — config/nav.ts LEGAL_LINKS):
 * - `terms`: versioned consent documents from the API (`GET /terms/:type`, auth module);
 * - `policy`: operating policies the operator edits in the back-office (`GET /policies/:slug`,
 *   ASSUMED endpoint) — nothing is hard-coded: the page says "준비 중" until one is published;
 * - `static`: 중개보수 안내, rendered from the statutory fee table the calculator uses.
 */
export type PolicySlug =
  | 'service'
  | 'privacy'
  | 'location'
  | 'marketing'
  | 'brokerage-fee'
  | 'false-listing';

export type PolicyDoc =
  | { slug: PolicySlug; kind: 'terms'; type: TermsType; label: string; description: string }
  | { slug: PolicySlug; kind: 'policy'; label: string; description: string }
  | { slug: PolicySlug; kind: 'static'; label: string; description: string };

export const POLICY_DOCS: readonly PolicyDoc[] = [
  {
    slug: 'service',
    kind: 'terms',
    type: TermsType.SERVICE,
    label: TERMS_TYPE_LABEL.SERVICE,
    description: '서비스를 이용할 때 회사와 회원이 지켜야 할 약속이에요.',
  },
  {
    slug: 'privacy',
    kind: 'terms',
    type: TermsType.PRIVACY,
    label: TERMS_TYPE_LABEL.PRIVACY,
    description: '어떤 개인정보를 왜 모으고, 얼마 동안 보관하는지 알려 드려요.',
  },
  {
    slug: 'location',
    kind: 'terms',
    type: TermsType.LOCATION,
    label: TERMS_TYPE_LABEL.LOCATION,
    description: '지도에서 내 위치를 쓸 때 적용되는 약관이에요.',
  },
  {
    slug: 'marketing',
    kind: 'terms',
    type: TermsType.MARKETING,
    label: TERMS_TYPE_LABEL.MARKETING,
    description: '분양 소식과 이벤트 안내를 받을지 정하는 선택 동의예요.',
  },
  {
    slug: 'brokerage-fee',
    kind: 'static',
    label: '중개보수 안내',
    description: '거래 유형과 금액에 따라 법으로 정한 중개보수 상한요율이에요.',
  },
  {
    slug: 'false-listing',
    kind: 'policy',
    label: '허위매물 신고 정책',
    description: '허위매물의 기준과 신고 뒤 처리 절차를 안내해요.',
  },
];

export const policyHref = (slug: PolicySlug): string => `/terms/${slug}`;

export function findPolicy(slug: string): PolicyDoc | undefined {
  return POLICY_DOCS.find((d) => d.slug === slug);
}
