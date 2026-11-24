import { PrismaService } from '../../../prisma/prisma.service';
import { HomeUserDataService } from '../../home/services/home-user-data.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';
import { MediaService } from '../../media/media.service';
import { WithdrawnIdentityService } from '../users/withdrawn-identity.service';
/**
 * Scrubs personal data of withdrawn members once their grace period (piiScrubAfter) has passed:
 * profile fields, identities, consent ip/UA, phone + ip on their reports, their notifications,
 * recent views and favorites (매물, 단지), 관심 중개사무소 + 관심 지역 (HomeUserDataService.purge:
 * those tables have no FK to users), and the name / title / phone / license number on their former
 * agency staff rows (and any listing contact still pointing at those); uploaded file names are
 * forgotten and unattached uploads deleted (MediaService.scrubOwner). Also drops expired
 * rejoin-cooldown tombstones.
 * Idempotent: only rows not yet scrubbed are touched, so re-running (or a retry) is harmless.
 * The User row itself stays (FKs from listings, reports, audit) as an anonymous tombstone.
 * Deal requests are erased at withdrawal time (AccountService.withdraw → DealRequestMaintenance).
 */
export declare class PiiScrubService {
    private readonly prisma;
    private readonly withdrawn;
    private readonly media;
    private readonly listings;
    private readonly homeData;
    private readonly logger;
    constructor(prisma: PrismaService, withdrawn: WithdrawnIdentityService, media: MediaService, listings: ListingsModerationService, homeData: HomeUserDataService);
    scrubDue(now?: Date): Promise<number>;
}
