import { DealType, TradeDealType } from '@house/shared';
import type { ComplexDetail } from '@/features/w-complex/api/schemas';
import type { ListingDetail } from '../api/schemas';

/** 실거래 deal type a listing's asking price is compared with (분양권 has no 실거래 series). */
const TRADE_DEAL: Partial<Record<DealType, TradeDealType>> = {
  [DealType.SALE]: TradeDealType.SALE,
  [DealType.JEONSE]: TradeDealType.JEONSE,
  [DealType.MONTHLY]: TradeDealType.MONTHLY,
};

/** The 평형 whose 전용면적 matches the listing's (±1㎡), when the listing does not name one. */
export function matchAreaType(
  areaTypes: readonly { id: string; exclusiveArea: number }[],
  exclusiveArea: number | null | undefined,
): string | null {
  if (!exclusiveArea) return null;
  const best = [...areaTypes].sort(
    (a, b) => Math.abs(a.exclusiveArea - exclusiveArea) - Math.abs(b.exclusiveArea - exclusiveArea),
  )[0];
  return best && Math.abs(best.exclusiveArea - exclusiveArea) <= 1 ? best.id : null;
}

/**
 * The public listing detail names its 단지 only ({ id, name, households, builtYear }); the page's
 * 단지 facts, 평형 list and 최근 실거래 come from `GET /complexes/:id`. Fields the listing already
 * carries win.
 */
export function withComplexDetail(l: ListingDetail, c: ComplexDetail | null): ListingDetail {
  if (!l.complex || !c || c.id !== l.complex.id) return l;
  const own = l.complex;
  const areaTypes = own.areaTypes.length
    ? own.areaTypes
    : c.areaTypes.map((t) => ({
        id: t.id,
        exclusiveArea: t.exclusiveArea,
        supplyArea: t.supplyArea,
        pyeongLabel: t.pyeongLabel,
      }));
  const areaTypeId = l.property.areaTypeId ?? matchAreaType(areaTypes, l.property.exclusiveArea);
  const dealType = TRADE_DEAL[l.dealType];
  const trade =
    !own.latestTrade && dealType && areaTypeId
      ? c.latestTrades
          .filter((t) => t.dealType === dealType && t.areaTypeId === areaTypeId && !t.cancelled)
          .sort((a, b) => (a.dealDate < b.dealDate ? 1 : -1))[0]
      : undefined;
  const price = trade ? (trade.price ?? trade.deposit) : null;
  return {
    ...l,
    property: { ...l.property, areaTypeId },
    complex: {
      ...own,
      emdName: own.emdName ?? c.emdName,
      households: own.households ?? c.households,
      builtYear: own.builtYear ?? c.builtYear,
      approvalDate: own.approvalDate ?? c.approvalDate,
      parkingPerHousehold: own.parkingPerHousehold ?? c.parkingPerHousehold,
      heatingType: own.heatingType ?? c.heatingType,
      avgPricePerPyeong: own.avgPricePerPyeong ?? c.avgPricePerPyeong,
      areaTypes,
      latestTrade:
        own.latestTrade ??
        (trade && price !== null
          ? {
              price,
              dealDate: trade.dealDate,
              floor: trade.floor,
              pyeongLabel: areaTypes.find((t) => t.id === areaTypeId)?.pyeongLabel ?? null,
            }
          : null),
    },
  };
}
