import type { AdminBannerView, AdminPopupView, BannerSlotView, BannerStatsView, Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminBannerListQueryDto, AdminPopupListQueryDto, BannerSlotParamDto, BannerStatsQueryDto, CreateBannerDto, CreatePopupDto, IdParamDto, ReorderBannersDto, ReorderPopupsDto, UpdateBannerDto, UpdateBannerSlotDto, UpdatePopupDto } from '../dto';
import { BannerAdminService } from '../services/banner-admin.service';
import { BannerSlotsService } from '../services/banner-slots.service';
import { BannerStatsService } from '../services/banner-stats.service';
import { PopupAdminService } from '../services/popup-admin.service';
export declare class AdminBannersController {
    private readonly banners;
    private readonly stats;
    constructor(banners: BannerAdminService, stats: BannerStatsService);
    list(q: AdminBannerListQueryDto): Promise<Paginated<AdminBannerView>>;
    reorder(dto: ReorderBannersDto): Promise<{
        items: AdminBannerView[];
    }>;
    get(p: IdParamDto): Promise<AdminBannerView>;
    bannerStats(p: IdParamDto, q: BannerStatsQueryDto): Promise<BannerStatsView>;
    create(dto: CreateBannerDto, admin: AdminPrincipal): Promise<AdminBannerView>;
    update(p: IdParamDto, dto: UpdateBannerDto): Promise<AdminBannerView>;
    remove(p: IdParamDto): Promise<void>;
}
/** Slot limits: readable by operators (banner forms need them), editable by ADMIN+. */
export declare class AdminBannerSlotsController {
    private readonly slots;
    constructor(slots: BannerSlotsService);
    list(): Promise<{
        items: BannerSlotView[];
    }>;
    get(p: BannerSlotParamDto): Promise<BannerSlotView>;
    update(p: BannerSlotParamDto, dto: UpdateBannerSlotDto): Promise<BannerSlotView>;
}
export declare class AdminPopupsController {
    private readonly popups;
    constructor(popups: PopupAdminService);
    list(q: AdminPopupListQueryDto): Promise<Paginated<AdminPopupView>>;
    reorder(dto: ReorderPopupsDto): Promise<{
        items: AdminPopupView[];
    }>;
    get(p: IdParamDto): Promise<AdminPopupView>;
    create(dto: CreatePopupDto, admin: AdminPrincipal): Promise<AdminPopupView>;
    update(p: IdParamDto, dto: UpdatePopupDto): Promise<AdminPopupView>;
    remove(p: IdParamDto): Promise<void>;
}
