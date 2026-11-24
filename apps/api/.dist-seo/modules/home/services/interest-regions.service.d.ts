import { PrismaService } from '../../../prisma/prisma.service';
import type { InterestRegionsInput } from '../dto';
/** GET / PUT /me/interest-regions (web w-auth `interestRegionsSchema`). */
export interface InterestRegionsView {
    regionKeys: string[];
    /** 선택한 지역에 새 매물이 오르면 알림 받기. */
    notify: boolean;
}
/** 관심 지역 of a user (one row per user; no row = nothing selected). */
export declare class InterestRegionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    get(userId: string): Promise<InterestRegionsView>;
    /** Replaces the selection (already deduplicated, canonical and capped by the DTO). */
    put(userId: string, dto: InterestRegionsInput): Promise<InterestRegionsView>;
}
