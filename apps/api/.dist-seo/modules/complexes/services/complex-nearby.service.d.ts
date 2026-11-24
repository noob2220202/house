import { AssetType, DealType } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { type ComplexMediaPort } from '../ports/complex-media.port';
import { ComplexListingsService } from './complex-listings.service';
/** Item of GET /complexes/:id/nearby (web w-complex `nearbyComplexSchema`). */
export interface NearbyComplexView {
    id: string;
    name: string;
    assetType: AssetType;
    emdName: string | null;
    lat: number;
    lng: number;
    /** Straight-line distance in metres (rounded). */
    distanceM: number;
    households: number | null;
    builtYear: number | null;
    activeListingCount: number;
    dealCounts: {
        presale: number;
        sale: number;
        jeonse: number;
        monthly: number;
    };
    /** Representative 평형 (most households) + price for the marker: "34평 4.4억". */
    representative: {
        pyeongLabel: string | null;
        price: number | null;
        dealType: DealType;
    } | null;
}
/** Item of GET /complexes/:id/agencies (web w-complex `complexAgencySchema`). */
export interface ComplexAgencyView {
    agencyId: string;
    name: string;
    representativeName: string | null;
    phone: string | null;
    logoUrl: string | null;
    /** Free-text specialty line — not in the model yet. */
    specialtyLabel: string | null;
    /** The office's public listings in this 단지. */
    complexListingCount: number;
    /** Not measured yet (no inquiry backend, DECISIONS D5). */
    avgResponseMinutes: number | null;
}
/** 주변 단지 and the offices advertising in a 단지 (단지 page side panels). */
export declare class ComplexNearbyService {
    private readonly prisma;
    private readonly listings;
    private readonly media;
    constructor(prisma: PrismaService, listings: ComplexListingsService, media: ComplexMediaPort);
    /** Live 단지 within `radiusM` of this one, nearest first. */
    nearby(id: string, limit: number, radiusM: number): Promise<NearbyComplexView[]>;
    /** Approved offices with public listings in the 단지, most listings first. */
    agencies(id: string, limit: number): Promise<ComplexAgencyView[]>;
    /** Lowest public asking price per (단지, deal type, 평형) — key `complexId|dealType|areaTypeId`. */
    private minListingPrices;
    /** Latest (not cancelled) 매매 실거래가 per 평형. */
    private latestSalePrices;
}
