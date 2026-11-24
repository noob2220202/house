import { type AgencyListingCard, type AgencyListingCounts } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { type AgencyMediaPort } from './agency-media.port';
/**
 * Read-only view of an agency's listings for its public profile. The listings module owns those
 * tables and exposes no reader yet, so this binding queries them read-only; swap it for a
 * ListingsModule service once one exists.
 */
export interface AgencyListingsReader {
    counts(agencyId: string): Promise<AgencyListingCounts>;
    representative(agencyId: string, limit: number): Promise<AgencyListingCard[]>;
}
export declare const AGENCY_LISTINGS_READER: unique symbol;
export declare class PrismaAgencyListingsReader implements AgencyListingsReader {
    private readonly prisma;
    private readonly media;
    constructor(prisma: PrismaService, media: AgencyMediaPort);
    /**
     * Advertised (ACTIVE) listings the agency is an active (co-)broker of, by type. A listing whose
     * primary agency is suspended is not advertised, even through its co-brokers.
     */
    counts(agencyId: string): Promise<AgencyListingCounts>;
    /** 대표 매물: most recently 실매물-verified, then newest. No 동/호 or address detail. */
    representative(agencyId: string, limit: number): Promise<AgencyListingCard[]>;
}
