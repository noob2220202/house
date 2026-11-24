import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SocialLoginStatus } from '../schemas';
/**
 * "7f3c1234567890a91e" → "7f3c••••••••••a91e"; a Google id keeps its public suffix
 * (".apps.googleusercontent.com"). Short ids are fully masked.
 */
export declare function maskClientId(clientId: string | undefined | null): string | null;
/**
 * GET /admin/social-login — read-only status of the OAuth providers. Configuration comes from the
 * API environment (client secrets are never returned, client ids only masked); activity from the
 * identities table: `lastSuccessAt` / `last24h.success` count sign-ins (Identity.lastUsedAt) and
 * `userShare` the share of non-withdrawn members linked to the provider. Failed callbacks are not
 * recorded, so `last24h.failure` is 0 and `healthy` means "configured".
 */
export declare class SocialLoginStatusService {
    private readonly prisma;
    private readonly config;
    constructor(prisma: PrismaService, config: AppConfig);
    status(now?: Date): Promise<SocialLoginStatus>;
}
