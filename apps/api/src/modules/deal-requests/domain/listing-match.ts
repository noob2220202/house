import { DealRequestType, DealType, type AssetType } from '@house/shared';

/** The request conditions a listing is ranked against (agency view of the request). */
export interface MatchRequest {
  type: DealRequestType;
  assetType: AssetType;
  dealTypes: readonly DealType[];
  emdCode: string | null;
  complexId: string | null;
  regionCodes: readonly string[];
  complexIds: readonly string[];
  priceMin: number | null;
  priceMax: number | null;
  depositMin: number | null;
  depositMax: number | null;
  rentMin: number | null;
  rentMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  roomsMin: number | null;
}

/** Listing fields used for ranking (console money convention: price = 매매/전세/분양권). */
export interface MatchListing {
  assetType: AssetType;
  dealType: DealType;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: number | null;
  rooms: number | null;
  emdCode: string | null;
  complexId: string | null;
}

const has = (n: number | null | undefined): n is number => typeof n === 'number';

/** true = inside, false = outside, null = no bound stated. */
function within(value: number | null, min: number | null, max: number | null): boolean | null {
  if (!has(min) && !has(max)) return null;
  if (!has(value)) return false;
  return (!has(min) || value >= min) && (!has(max) || value <= max);
}

function regionOk(r: MatchRequest, l: MatchListing): boolean | null {
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    // Comparable listings: same complex first, then the same 읍면동.
    if (r.complexId && l.complexId === r.complexId) return true;
    if (!r.emdCode) return null;
    return !!l.emdCode && l.emdCode.slice(0, 8) === r.emdCode.slice(0, 8);
  }
  if (l.complexId && r.complexIds.includes(l.complexId)) return true;
  if (r.regionCodes.length === 0 && r.complexIds.length === 0) return null;
  return !!l.emdCode && r.regionCodes.some((c) => l.emdCode!.startsWith(c));
}

function budgetOk(r: MatchRequest, l: MatchListing): boolean | null {
  if (r.type === DealRequestType.SELL_OR_LEASE) return null;
  if (l.dealType === DealType.MONTHLY) {
    const deposit = within(l.deposit, r.depositMin, r.depositMax);
    const rent = within(l.monthlyRent, r.rentMin, r.rentMax);
    if (deposit === null && rent === null) return null;
    return deposit !== false && rent !== false;
  }
  if (l.dealType === DealType.JEONSE) return within(l.price, r.depositMin, r.depositMax);
  return within(l.price, r.priceMin, r.priceMax);
}

/**
 * How well one of the agency's listings fits a request: the number of satisfied conditions
 * (asset type, deal type, region / complex, budget, area, rooms) and whether all stated ones
 * are. Same rule as the web picker
 * (`a-inbox/lib/match.ts`), so the server order and the "조건 일치" hint agree. A hint, never a
 * filter: every active listing may be attached.
 */
export function matchScore(r: MatchRequest, l: MatchListing): { full: boolean; score: number } {
  const checks: (boolean | null)[] = [
    l.assetType === r.assetType,
    r.dealTypes.includes(l.dealType),
    regionOk(r, l),
    budgetOk(r, l),
    r.type === DealRequestType.WANTED ? within(l.exclusiveArea, r.areaMin, r.areaMax) : null,
    r.type === DealRequestType.WANTED && has(r.roomsMin)
      ? has(l.rooms) && l.rooms >= r.roomsMin
      : null,
  ];
  const stated = checks.filter((c) => c !== null);
  const score = stated.filter((c) => c).length;
  return { full: stated.length > 0 && score === stated.length, score };
}

/** Full matches first, then by score; ties keep the incoming order (stable sort). */
export function rankByMatch<T extends MatchListing>(r: MatchRequest, listings: readonly T[]): T[] {
  return listings
    .map((listing, index) => ({ listing, m: matchScore(r, listing), index }))
    .sort(
      (a, b) => Number(b.m.full) - Number(a.m.full) || b.m.score - a.m.score || a.index - b.index,
    )
    .map((x) => x.listing);
}
