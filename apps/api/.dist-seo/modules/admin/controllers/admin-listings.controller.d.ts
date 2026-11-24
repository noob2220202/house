import type { AdminListingDetail, AdminListingListItem, Paginated } from '@house/shared';
import { AdminListingListQueryDto, AdminListingModerationDto, IdParamDto } from '../dto';
import { AdminListingsService } from '../services/admin-listings.service';
/** Listing moderation across all agencies: hide / unhide / force close. */
export declare class AdminListingsController {
    private readonly listings;
    constructor(listings: AdminListingsService);
    list(q: AdminListingListQueryDto): Promise<Paginated<AdminListingListItem>>;
    detail(p: IdParamDto): Promise<AdminListingDetail>;
    hide(p: IdParamDto, dto: AdminListingModerationDto): Promise<AdminListingDetail>;
    unhide(p: IdParamDto): Promise<AdminListingDetail>;
    close(p: IdParamDto, dto: AdminListingModerationDto): Promise<AdminListingDetail>;
}
