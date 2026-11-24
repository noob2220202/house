import { DEFAULT_SGG_CODE, canonicalRegionCode } from '@house/shared';
import { BRAND } from '@/config/brand';

/**
 * Service area of the 내놓기 / 구하기 forms.
 *
 * 순천시 is 12150 (전남광주통합특별시, since 2026-07-01, D1). Codes are compared after
 * `canonicalRegionCode`, so an address that still carries the legacy 46150… code (cached postcode
 * data, old links) is inside the area and is sent with its current code. Override the list with
 * NEXT_PUBLIC_REGION_SGG_CODES (comma separated, the first one is the primary code) when the
 * backend's REGION_SGG_CODE changes. See docs/frontend-integration/w-deal.md.
 */
export const SERVICE_SGG_CODES: readonly string[] = (
  process.env.NEXT_PUBLIC_REGION_SGG_CODES || DEFAULT_SGG_CODE
)
  .split(',')
  .map((c) => canonicalRegionCode(c.trim()))
  .filter((c) => /^\d{5}$/.test(c));

/** True when a 법정동코드 (10 digits) lies inside one of the service 시군구. */
export function isServiceRegionCode(code: string): boolean {
  const current = canonicalRegionCode(code);
  return SERVICE_SGG_CODES.some((sgg) => current.startsWith(sgg));
}

/** Fields of the postcode result used for the check (all optional — older payloads lack some). */
export interface ServiceAreaInput {
  bcode: string;
  sigungu?: string;
  sigunguCode?: string;
}

/**
 * Address inside the service area? Matches the 시군구 name ("순천시") or any service 시군구 code.
 * An empty bcode (address typed by hand when the widget failed) is accepted — the backend
 * geocodes and validates it again.
 */
export function inServiceArea(data: ServiceAreaInput): boolean {
  if (data.sigungu && data.sigungu === BRAND.region) return true;
  if (data.sigunguCode && SERVICE_SGG_CODES.includes(canonicalRegionCode(data.sigunguCode)))
    return true;
  if (data.bcode === '') return !data.sigungu && !data.sigunguCode;
  return isServiceRegionCode(data.bcode);
}

/** Region codes for the reach lookup of an address: its current 법정동코드, only inside the service area. */
export function serviceRegionCodesOf(bcode: string): string[] {
  return bcode && isServiceRegionCode(bcode) ? [canonicalRegionCode(bcode)] : [];
}

const SIDO_ABBR =
  /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)$/;
const SIDO_FULL = /(특별시|광역시|특별자치시|특별자치도|도)$/;

/**
 * Address for cards and summaries without the leading 시·도 ("전남광주통합특별시 순천시 왕지2길 9-3"
 * → "순천시 왕지2길 9-3"). The stored / submitted address keeps the full text.
 */
export function displayAddress(address: string | null | undefined): string {
  const text = (address ?? '').trim();
  const [first, ...rest] = text.split(/\s+/);
  if (!first || rest.length === 0) return text;
  return SIDO_ABBR.test(first) || SIDO_FULL.test(first) ? rest.join(' ') : text;
}
