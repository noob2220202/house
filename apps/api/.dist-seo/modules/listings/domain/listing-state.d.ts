import type { AssetType, BuildingUse, DealType, Direction, DirectionBasis, FloorDisplay, ListingDraftInput, ListingOption, ListingUpdateInput, MaintenanceFee, MoveInType, PropertyInput, PropertyUpdateInput, PublishCheckInput, RoomType } from '@house/shared';
import { Prisma, type Listing, type Property } from '@prisma/client';
import { type PropertySearchColumns } from './search-columns';
/**
 * Plain (number/Date) working copies of a property and a listing. The write path merges patches
 * into these, validates them, and derives the denormalized search columns from them.
 */
export interface PropertyState {
    assetType: AssetType;
    complexId: string | null;
    areaTypeId: string | null;
    roadAddress: string;
    jibunAddress: string | null;
    buildingName: string | null;
    dong: string | null;
    ho: string | null;
    sggCode: string;
    emdCode: string | null;
    lat: number;
    lng: number;
    floor: number | null;
    totalFloors: number | null;
    exclusiveArea: number | null;
    supplyArea: number | null;
    landArea: number | null;
    totalFloorArea: number | null;
    rooms: number | null;
    roomType: RoomType | null;
    baths: number | null;
    direction: Direction | null;
    directionBasis: DirectionBasis | null;
    approvalDate: Date | null;
    parkingSpaces: number | null;
    heatingType: string | null;
    zoning: string | null;
    landCategory: string | null;
    buildingUse: BuildingUse | null;
}
export interface ListingState {
    dealType: DealType;
    title: string | null;
    description: string | null;
    salePrice: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    presalePrice: number | null;
    premium: number | null;
    maintenanceFeeWon: number | null;
    maintenanceFee: MaintenanceFee | null;
    moveInType: MoveInType | null;
    moveInDate: Date | null;
    floorDisplay: FloorDisplay;
    options: ListingOption[];
}
export declare function propertyStateFromInput(p: PropertyInput, sggCode: string): PropertyState;
export declare function propertyStateFromRow(p: Property): PropertyState;
/** Applies a PATCH (undefined = keep, null = clear). `sggCode` is derived by the caller. */
export declare function applyPropertyPatch(s: PropertyState, patch: PropertyUpdateInput): PropertyState;
export declare function listingStateFromInput(d: ListingDraftInput): ListingState;
/**
 * The stored JSON, validated against the shared schema. A row that no longer parses (hand-edited,
 * older shape) reads as "not entered", so publishing asks for the breakdown again.
 */
export declare function maintenanceFeeFromJson(v: Prisma.JsonValue | null): MaintenanceFee | null;
export declare function listingStateFromRow(l: Listing): ListingState;
export declare function applyListingPatch(s: ListingState, patch: ListingUpdateInput): ListingState;
/** True when the patch touches anything that a listing row derives from its property. */
export declare function hasPropertyChanges(patch: PropertyUpdateInput | undefined): boolean;
export interface ListingWriteColumns extends PropertySearchColumns, Omit<ListingState, 'maintenanceFee'> {
    maintenanceFee: Prisma.InputJsonValue | typeof Prisma.DbNull;
    priceSort: number | null;
}
/**
 * All listing columns derived from the two states (search columns + price sort key). Price fields
 * that don't apply to the deal type are nulled, so e.g. a 월세 listing switched to 매매 cannot keep
 * showing its old 월세 next to the 매매가.
 */
export declare function listingWriteColumns(l: ListingState, p: PropertyState, complexBuiltYear: number | null): ListingWriteColumns;
export declare function publishCheckInput(l: ListingState, p: PropertyState, agency: PublishCheckInput['agency']): PublishCheckInput;
