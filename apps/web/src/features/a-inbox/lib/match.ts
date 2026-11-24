import { DealRequestType, DealType } from '@house/shared';
import type { AgencyDealRequest, InboxListing } from '../api/schemas';

/**
 * How well one of our listings fits a request. Used to rank the listing picker and to show
 * "조건 일치" — a hint for the agent, never a filter (any active listing may be attached).
 */
export interface ListingMatch {
  /** Every condition the request states is satisfied. */
  full: boolean;
  /** Number of satisfied conditions (ranking key). */
  score: number;
  /** Labels of the satisfied conditions, e.g. ["지역", "거래 유형", "예산"]. */
  reasons: string[];
  /** Labels of the stated conditions the listing does not meet, e.g. ["예산"]. */
  misses: string[];
}

type MatchRequest = Pick<
  AgencyDealRequest,
  | 'type'
  | 'assetType'
  | 'dealTypes'
  | 'emdCode'
  | 'complexId'
  | 'regionCodes'
  | 'complexIds'
  | 'priceMin'
  | 'priceMax'
  | 'depositMin'
  | 'depositMax'
  | 'rentMin'
  | 'rentMax'
  | 'areaMin'
  | 'areaMax'
  | 'roomsMin'
>;

const has = (n: number | null | undefined): n is number => typeof n === 'number';

/** true = inside, false = outside, null = the request states no bound (or the listing has no value). */
function within(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean | null {
  if (!has(min) && !has(max)) return null;
  if (!has(value)) return false;
  return (!has(min) || value >= min) && (!has(max) || value <= max);
}

function regionCheck(r: MatchRequest, l: InboxListing): { ok: boolean | null; label: string } {
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    // Comparable listings: same complex first, then the same 읍면동.
    if (r.complexId && l.complexId === r.complexId) return { ok: true, label: '같은 단지' };
    if (!r.emdCode) return { ok: null, label: '지역' };
    return { ok: l.emdCode === r.emdCode, label: '같은 지역' };
  }
  if (l.complexId && r.complexIds.includes(l.complexId)) return { ok: true, label: '희망 단지' };
  if (r.regionCodes.length === 0 && r.complexIds.length === 0) return { ok: null, label: '지역' };
  return { ok: !!l.emdCode && r.regionCodes.includes(l.emdCode), label: '지역' };
}

function budgetCheck(r: MatchRequest, l: InboxListing): boolean | null {
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

export function matchListing(r: MatchRequest, l: InboxListing): ListingMatch {
  const region = regionCheck(r, l);
  const checks: { ok: boolean | null; label: string }[] = [
    { ok: l.assetType === r.assetType, label: '매물 종류' },
    { ok: r.dealTypes.includes(l.dealType), label: '거래 유형' },
    region,
    { ok: budgetCheck(r, l), label: '예산' },
    {
      ok: r.type === DealRequestType.WANTED ? within(l.exclusiveArea, r.areaMin, r.areaMax) : null,
      label: '면적',
    },
    {
      ok:
        r.type === DealRequestType.WANTED && has(r.roomsMin)
          ? has(l.rooms) && l.rooms >= r.roomsMin
          : null,
      label: '방 수',
    },
  ];
  const stated = checks.filter((c) => c.ok !== null);
  const passed = stated.filter((c) => c.ok);
  return {
    full: stated.length > 0 && passed.length === stated.length,
    score: passed.length,
    reasons: passed.map((c) => c.label),
    misses: stated.filter((c) => !c.ok).map((c) => c.label),
  };
}

/** Best matches first; ties keep the incoming (server) order. */
export function rankListings<T extends InboxListing>(
  r: MatchRequest,
  listings: readonly T[],
): { listing: T; match: ListingMatch }[] {
  return listings
    .map((listing, index) => ({ listing, match: matchListing(r, listing), index }))
    .sort(
      (a, b) =>
        Number(b.match.full) - Number(a.match.full) ||
        b.match.score - a.match.score ||
        a.index - b.index,
    )
    .map(({ listing, match }) => ({ listing, match }));
}
