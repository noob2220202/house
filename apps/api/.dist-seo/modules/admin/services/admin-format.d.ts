import { AgencyDocumentType, DealType } from '@house/shared';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
/**
 * Documents an application needs before it can be approved — the admin app's
 * `REQUIRED_AGENCY_DOCUMENTS` (m-moderation/lib/labels.ts).
 */
export declare const REQUIRED_AGENCY_DOCUMENTS: readonly AgencyDocumentType[];
export declare function documentChecklist(types: readonly AgencyDocumentType[]): {
    submitted: number;
    required: number;
    missing: AgencyDocumentType[];
    missingLabel: string | null;
};
/** "김서진" → "김*진", "한결" → "한*" (search results never show a member's full name). */
export declare function maskName(name: string | null | undefined): string | null;
type Decimalish = Prisma.Decimal | number | null | undefined;
/** "34평" from an exclusive area in ㎡ (null when unknown). */
export declare function pyeongLabel(area: Decimalish): string | null;
/** The price triple the admin app shows for a deal type (만원). */
export declare function priceFields(dealType: DealType, p: {
    salePrice?: number | null;
    presalePrice?: number | null;
    deposit?: number | null;
    monthlyRent?: number | null;
}): {
    price: number | null;
    deposit: number | null;
    monthlyRent: number | null;
};
/** "매매 3억 1,000" / "월세 2,000/65" — short price text for notification bodies. */
export declare function priceText(dealType: DealType, p: Parameters<typeof priceFields>[1], labels: Record<DealType, string>): string | null;
/**
 * Human headline of a listing: its title when the agency wrote one, else
 * "<complex | building | road address> · <평형>".
 */
export declare function listingHeadline(l: {
    title: string | null;
    exclusiveArea?: Decimalish;
    complex?: {
        name: string;
    } | null;
    property?: {
        buildingName: string | null;
        roadAddress: string;
    } | null;
}): string;
/** 읍면동 / 리 names for a set of region codes (one query). */
export declare function regionNames(db: PrismaTx, codes: readonly (string | null | undefined)[]): Promise<Map<string, string>>;
export {};
