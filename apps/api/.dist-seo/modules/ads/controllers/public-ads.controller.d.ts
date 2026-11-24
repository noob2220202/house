import type { PublicBannerView, PublicPopupView } from '@house/shared';
import type { Request } from 'express';
import { BannerImpressionBatchDto, BannerServeQueryDto, IdParamDto, PopupServeQueryDto } from '../dto';
import { AdServeService } from '../services/ad-serve.service';
import { AdTrackingService } from '../services/ad-tracking.service';
/**
 * Public ad serving + tracking. Beacons are POSTs: the frontend sends them with
 * `fetch(..., { method: 'POST', keepalive: true, credentials: 'include' })` plus the CSRF header
 * when logged in (sendBeacon cannot set headers). Beacons are not member actions, so they are
 * exempt from TermsConsentGuard (@SkipTermsCheck): they count for members with pending terms.
 */
export declare class PublicAdsController {
    private readonly serve;
    private readonly tracking;
    constructor(serve: AdServeService, tracking: AdTrackingService);
    banners(q: BannerServeQueryDto): Promise<{
        items: PublicBannerView[];
    }>;
    popups(q: PopupServeQueryDto): Promise<{
        items: PublicPopupView[];
    }>;
    impressions(dto: BannerImpressionBatchDto, req: Request): Promise<void>;
    impression(p: IdParamDto, req: Request): Promise<void>;
    click(p: IdParamDto, req: Request): Promise<{
        url: string;
        statusCode: number;
    }>;
}
