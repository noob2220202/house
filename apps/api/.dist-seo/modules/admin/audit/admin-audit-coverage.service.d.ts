import { type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
export interface AdminMutationRoute {
    controller: string;
    handler: string;
    method: string;
    path: string;
    /** Has @Audit(...) (otherwise the handler audits in its service, or the fallback does). */
    decorated: boolean;
}
/**
 * Inventory of every admin mutation route in the app (all modules) and whether it carries
 * @Audit. Logged once at bootstrap so a missing decorator is visible; AdminMutationAuditInterceptor
 * guarantees the audit row either way.
 */
export declare class AdminAuditCoverageService implements OnApplicationBootstrap {
    private readonly discovery;
    private readonly scanner;
    private readonly reflector;
    private readonly logger;
    constructor(discovery: DiscoveryService, scanner: MetadataScanner, reflector: Reflector);
    onApplicationBootstrap(): void;
    adminMutationRoutes(): AdminMutationRoute[];
}
