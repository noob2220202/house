import { BRAND } from '@/config/brand';

/**
 * Service area of the 내놓기 / 구하기 forms.
 *
 * 순천시 has two 시군구 codes in the wild: the classic 46150 (전라남도) that the backend seed and
 * packages/shared still default to, and 12150 that the Kakao postcode service returns since the
 * 전남·광주 통합 (sido "전남광주통합특별시"). Both are accepted; override the list with
 * NEXT_PUBLIC_REGION_SGG_CODES (comma separated, the first one is the primary code) when the
 * backend's REGION_SGG_CODE changes. See docs/frontend-integration/w-deal.md.
 */
export const SERVICE_SGG_CODES: readonly string[] = (
  process.env.NEXT_PUBLIC_REGION_SGG_CODES || '46150,12150'
)
  .split(',')
  .map((c) => c.trim())
  .filter((c) => /^\d{5}$/.test(c));

/** True when a 법정동코드 (10 digits) lies inside one of the service 시군구. */
export function isServiceRegionCode(code: string): boolean {
  return SERVICE_SGG_CODES.some((sgg) => code.startsWith(sgg));
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
  if (data.sigunguCode && SERVICE_SGG_CODES.includes(data.sigunguCode)) return true;
  if (data.bcode === '') return !data.sigungu && !data.sigunguCode;
  return isServiceRegionCode(data.bcode);
}

/** Region codes for the reach lookup of an address: its 법정동코드, only inside the service area. */
export function serviceRegionCodesOf(bcode: string): string[] {
  return bcode && isServiceRegionCode(bcode) ? [bcode] : [];
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
