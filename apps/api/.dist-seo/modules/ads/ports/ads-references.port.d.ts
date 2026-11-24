import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
/**
 * Read-only lookups into agencies / complexes / regions that banner validation and targeting
 * need. Kept behind a port so the module does not depend on those modules' internals.
 */
export interface AdsReferencesPort {
    /** Throws BANNER_AGENCY_INVALID unless the agency exists, is APPROVED and not deleted. */
    assertAgency(agencyId: string, db?: PrismaTx): Promise<void>;
    /** Throws BANNER_TARGET_INVALID (details.missing) unless every code is an active region. */
    assertRegions(codes: readonly string[], db?: PrismaTx): Promise<void>;
    /** Throws BANNER_TARGET_INVALID (details.missing) unless every complex exists (not deleted). */
    assertComplexes(ids: readonly string[], db?: PrismaTx): Promise<void>;
    /** Region codes of a complex (for region-targeted banners on complex pages). */
    complexRegionCodes(complexId: string): Promise<string[]>;
    /** Region codes of several complexes (unknown/deleted ids are absent from the map). */
    complexRegionCodesMany(ids: readonly string[], db?: PrismaTx): Promise<Map<string, string[]>>;
}
export declare const ADS_REFERENCES: unique symbol;
export declare class PrismaAdsReferences implements AdsReferencesPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    assertAgency(agencyId: string, db?: PrismaTx): Promise<void>;
    assertRegions(codes: readonly string[], db?: PrismaTx): Promise<void>;
    assertComplexes(ids: readonly string[], db?: PrismaTx): Promise<void>;
    complexRegionCodes(complexId: string): Promise<string[]>;
    complexRegionCodesMany(ids: readonly string[], db?: PrismaTx): Promise<Map<string, string[]>>;
}
