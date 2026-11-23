import {
  sqmToPyeong,
  type ComplexAreaTypeView,
  type ComplexSummary,
  type TradeView,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import { pyeongLabel } from '../../common/utils/area';
import { decimalToNumber } from '../../common/utils/decimal';

export const COMPLEX_SUMMARY_SELECT = {
  id: true,
  name: true,
  assetType: true,
  roadAddress: true,
  jibunAddress: true,
  sggCode: true,
  emdCode: true,
  emdName: true,
  lat: true,
  lng: true,
  households: true,
  buildings: true,
  builtYear: true,
  approvalDate: true,
  activeListingCount: true,
  favoriteCount: true,
  viewCount: true,
} as const satisfies Prisma.ComplexSelect;

export type ComplexSummaryRow = Prisma.ComplexGetPayload<{ select: typeof COMPLEX_SUMMARY_SELECT }>;

export const AREA_TYPE_SELECT = {
  id: true,
  exclusiveArea: true,
  supplyArea: true,
  typeName: true,
  pyeongLabel: true,
  households: true,
  rooms: true,
  baths: true,
} as const satisfies Prisma.ComplexAreaTypeSelect;

export type AreaTypeRow = Prisma.ComplexAreaTypeGetPayload<{ select: typeof AREA_TYPE_SELECT }>;

export const TRADE_SELECT = {
  id: true,
  dealType: true,
  dealDate: true,
  dealYm: true,
  exclusiveArea: true,
  areaTypeId: true,
  floor: true,
  price: true,
  deposit: true,
  monthlyRent: true,
  cancelled: true,
  cancelledAt: true,
  contractType: true,
} as const satisfies Prisma.TradeRecordSelect;

export type TradeRow = Prisma.TradeRecordGetPayload<{ select: typeof TRADE_SELECT }>;

export function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** 평형 label: explicit, else from 공급면적 (Korean 평형 convention), else from 전용면적. */
export function areaTypeLabel(row: {
  pyeongLabel: string | null;
  supplyArea: Prisma.Decimal | null;
  exclusiveArea: Prisma.Decimal;
}): string {
  if (row.pyeongLabel) return row.pyeongLabel;
  return pyeongLabel(decimalToNumber(row.supplyArea ?? row.exclusiveArea) ?? 0);
}

export function toComplexSummary(r: ComplexSummaryRow): ComplexSummary {
  return {
    id: r.id,
    name: r.name,
    assetType: r.assetType,
    roadAddress: r.roadAddress,
    jibunAddress: r.jibunAddress,
    sggCode: r.sggCode,
    emdCode: r.emdCode,
    emdName: r.emdName,
    lat: r.lat,
    lng: r.lng,
    households: r.households,
    buildings: r.buildings,
    builtYear: r.builtYear,
    approvalDate: isoDate(r.approvalDate),
    activeListingCount: r.activeListingCount,
    favoriteCount: r.favoriteCount,
    viewCount: r.viewCount,
  };
}

export function toAreaTypeView(r: AreaTypeRow): ComplexAreaTypeView {
  const exclusiveArea = decimalToNumber(r.exclusiveArea) ?? 0;
  const supplyArea = decimalToNumber(r.supplyArea);
  return {
    id: r.id,
    exclusiveArea,
    supplyArea,
    exclusivePyeong: sqmToPyeong(exclusiveArea),
    supplyPyeong: supplyArea === null ? null : sqmToPyeong(supplyArea),
    typeName: r.typeName,
    pyeongLabel: areaTypeLabel(r),
    households: r.households,
    rooms: r.rooms,
    baths: r.baths,
  };
}

export function toTradeView(r: TradeRow): TradeView {
  const exclusiveArea = decimalToNumber(r.exclusiveArea) ?? 0;
  return {
    id: r.id,
    dealType: r.dealType,
    dealDate: r.dealDate.toISOString().slice(0, 10),
    yearMonth: r.dealYm,
    exclusiveArea,
    exclusivePyeong: sqmToPyeong(exclusiveArea),
    areaTypeId: r.areaTypeId,
    floor: r.floor,
    price: r.price,
    deposit: r.deposit,
    monthlyRent: r.monthlyRent,
    cancelled: r.cancelled,
    cancelledAt: isoDate(r.cancelledAt),
    contractType: r.contractType,
  };
}
