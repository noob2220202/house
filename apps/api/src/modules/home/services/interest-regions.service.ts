import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { InterestRegionsInput } from '../dto';

/** GET / PUT /me/interest-regions (web w-auth `interestRegionsSchema`). */
export interface InterestRegionsView {
  regionKeys: string[];
  /** 선택한 지역에 새 매물이 오르면 알림 받기. */
  notify: boolean;
}

/** 관심 지역 of a user (one row per user; no row = nothing selected). */
@Injectable()
export class InterestRegionsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<InterestRegionsView> {
    const row = await this.prisma.userInterestRegion.findUnique({
      where: { userId },
      select: { regionKeys: true, notify: true },
    });
    return { regionKeys: row?.regionKeys ?? [], notify: row?.notify ?? false };
  }

  /** Replaces the selection (already deduplicated, canonical and capped by the DTO). */
  async put(userId: string, dto: InterestRegionsInput): Promise<InterestRegionsView> {
    const row = await this.prisma.userInterestRegion.upsert({
      where: { userId },
      create: { userId, regionKeys: dto.regionKeys, notify: dto.notify },
      update: { regionKeys: dto.regionKeys, notify: dto.notify },
      select: { regionKeys: true, notify: true },
    });
    return { regionKeys: row.regionKeys, notify: row.notify };
  }
}
