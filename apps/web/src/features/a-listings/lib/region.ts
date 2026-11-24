import { REGION_CODE_LENGTH, canonicalRegionCode } from '@house/shared';

/**
 * 법정동코드 of a listing as the shared draft schema expects it: 10 digits, canonical (D1:
 * a legacy 46150… code becomes 12150…). Sources:
 * - the address search (`GET /geo/geocode` → `emdCode`, or a Kakao postcode `bcode`): 10 digits;
 * - a complex (`emdCode`, 읍면동 level): 8 digits → the 동 row `…00`.
 * Anything else (5-digit 시군구, junk) → undefined: the publish check then reports 소재지(법정동).
 */
export function listingEmdCode(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const canonical = canonicalRegionCode(code.trim());
  if (/^\d{10}$/.test(canonical)) return canonical;
  if (new RegExp(`^\\d{${REGION_CODE_LENGTH.EMD}}$`).test(canonical)) return `${canonical}00`;
  return undefined;
}
