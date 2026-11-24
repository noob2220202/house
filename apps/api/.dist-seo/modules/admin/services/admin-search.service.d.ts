import { PrismaService } from '../../../prisma/prisma.service';
import { type AdminSearchQuery, type AdminSearchResult } from '../schemas';
/** The query as typed and without spaces / hyphens ("신대 레이크-파크" also finds "신대레이크파크"). */
export declare function searchVariants(q: string): string[];
/** Registration-number search key, the way `agencies.registration_key` is generated. */
export declare function registrationKeyOf(q: string): string;
/**
 * Topbar search of the back office: listings (매물번호, title, complex, building, address, office, 읍면동),
 * agencies (name, 대표, 등록번호, address, 읍면동) and members (nickname, name, e-mail, phone).
 * Members are matched on full values but returned masked. Read-only, never cached (free text).
 */
export declare class AdminSearchService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    search(q: AdminSearchQuery): Promise<AdminSearchResult>;
    /** 읍면동 / 리 of the service area whose name matches ("조례" → 조례동). */
    private matchingRegionCodes;
    private listings;
    private agencies;
    private users;
}
