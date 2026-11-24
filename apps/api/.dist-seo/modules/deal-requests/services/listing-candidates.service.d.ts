import { DealType, type AssetType, type Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ListingCandidateQuery } from '../dto';
import { type DealRequestMediaPort } from '../ports/media.port';
import { AgencyActorService } from './agency-actor.service';
import { RegionNamesService } from './region-names.service';
/** A listing of the caller's agency in the proposal picker (web `inboxListingSchema`, 만원 / ㎡). */
export interface ListingCandidateView {
    id: string;
    title: string;
    assetType: AssetType;
    dealType: DealType;
    /** 매매가 / 전세 보증금 / 분양권 매매가 (분양가 + 프리미엄). */
    price: number | null;
    /** 월세 보증금. */
    deposit: number | null;
    monthlyRent: number | null;
    exclusiveArea: number | null;
    floorLabel: string | null;
    rooms: number | null;
    emdCode: string | null;
    emdName: string | null;
    complexId: string | null;
    thumbUrl: string | null;
    verifiedAt: string | null;
}
/**
 * GET /agency/deal-requests/:id/listing-candidates — the agency's ACTIVE listings that may be
 * attached to a proposal for a request it can see (the proposal rule: ACTIVE + actively
 * (co-)brokered), best match for the request first. Reads the listing tables read-only.
 */
export declare class ListingCandidatesService {
    private readonly prisma;
    private readonly actors;
    private readonly regionNames;
    private readonly media;
    constructor(prisma: PrismaService, actors: AgencyActorService, regionNames: RegionNamesService, media: DealRequestMediaPort);
    list(user: UserPrincipal, id: string, q: ListingCandidateQuery, now?: Date): Promise<Paginated<ListingCandidateView>>;
    private toView;
}
