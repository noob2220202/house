import { type ComplexAreaTypeView, type ComplexSummary, type TradeView } from '@house/shared';
import { Prisma } from '@prisma/client';
export declare const COMPLEX_SUMMARY_SELECT: {
    readonly id: true;
    readonly name: true;
    readonly assetType: true;
    readonly roadAddress: true;
    readonly jibunAddress: true;
    readonly sggCode: true;
    readonly emdCode: true;
    readonly emdName: true;
    readonly lat: true;
    readonly lng: true;
    readonly households: true;
    readonly buildings: true;
    readonly builtYear: true;
    readonly approvalDate: true;
    readonly activeListingCount: true;
    readonly favoriteCount: true;
    readonly viewCount: true;
};
export type ComplexSummaryRow = Prisma.ComplexGetPayload<{
    select: typeof COMPLEX_SUMMARY_SELECT;
}>;
export declare const AREA_TYPE_SELECT: {
    readonly id: true;
    readonly exclusiveArea: true;
    readonly supplyArea: true;
    readonly typeName: true;
    readonly pyeongLabel: true;
    readonly households: true;
    readonly rooms: true;
    readonly baths: true;
};
export type AreaTypeRow = Prisma.ComplexAreaTypeGetPayload<{
    select: typeof AREA_TYPE_SELECT;
}>;
export declare const TRADE_SELECT: {
    readonly id: true;
    readonly dealType: true;
    readonly dealDate: true;
    readonly dealYm: true;
    readonly exclusiveArea: true;
    readonly areaTypeId: true;
    readonly floor: true;
    readonly price: true;
    readonly deposit: true;
    readonly monthlyRent: true;
    readonly cancelled: true;
    readonly cancelledAt: true;
    readonly contractType: true;
};
export type TradeRow = Prisma.TradeRecordGetPayload<{
    select: typeof TRADE_SELECT;
}>;
export declare function isoDate(d: Date | null): string | null;
/** 평형 label: explicit, else from 공급면적 (Korean 평형 convention), else from 전용면적. */
export declare function areaTypeLabel(row: {
    pyeongLabel: string | null;
    supplyArea: Prisma.Decimal | null;
    exclusiveArea: Prisma.Decimal;
}): string;
export declare function toComplexSummary(r: ComplexSummaryRow): ComplexSummary;
export declare function toAreaTypeView(r: AreaTypeRow): ComplexAreaTypeView;
export declare function toTradeView(r: TradeRow): TradeView;
