import { AgencyStatus, ErrorCode, PUBLIC_LISTING_STATUSES } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PRIMARY_AGENCY_APPROVED_SQL,
  PUBLIC_STATUS_SQL,
} from '../../listings/listing-search.repository';
import { SEO_CACHE_TTL_SECONDS, SITEMAP_MAX_URLS } from '../constants';
import { regionKeyOf } from '../seo.domain';
import type { SeoListingStatusView, SeoSitemapKind, SeoSitemapView } from '../seo.types';

const PUBLIC_LISTING_SQL = Prisma.sql`l.deleted_at IS NULL AND ${PUBLIC_STATUS_SQL} AND ${PRIMARY_AGENCY_APPROVED_SQL}`;

/**
 * URL inventories for the web sitemaps (every public 단지 / 매물 / 중개사무소 with its last change)
 * and the "gone" status of a listing URL that is no longer public.
 */
@Injectable()
export class SeoSitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
  ) {}

  private get sggCode(): string {
    return this.config.get('REGION_SGG_CODE');
  }

  sitemap(kind: SeoSitemapKind): Promise<SeoSitemapView> {
    return this.cache.getOrSet(
      `cache:seo:sitemap:${this.sggCode}:${kind}`,
      SEO_CACHE_TTL_SECONDS.SITEMAP,
      async () => {
        const rows = await this.rows(kind);
        return {
          kind,
          items: rows.slice(0, SITEMAP_MAX_URLS).map((r) => ({
            id: r.id,
            lastModified: r.lastModified.toISOString(),
          })),
          truncated: rows.length > SITEMAP_MAX_URLS,
        };
      },
    );
  }

  private rows(kind: SeoSitemapKind): Promise<{ id: string; lastModified: Date }[]> {
    const sgg = this.sggCode;
    const take = SITEMAP_MAX_URLS + 1;
    switch (kind) {
      // A 단지 page changes with its own row, its 실거래 and its public listings.
      case 'complexes':
        return this.prisma.$queryRaw`
          SELECT c.id, GREATEST(
              c.updated_at,
              COALESCE((SELECT max(t.updated_at) FROM trade_records t WHERE t.complex_id = c.id), c.updated_at),
              COALESCE((SELECT max(l.updated_at) FROM listings l
                WHERE l.complex_id = c.id AND ${PUBLIC_LISTING_SQL}), c.updated_at)
            ) AS "lastModified"
          FROM complexes c
          WHERE c.deleted_at IS NULL AND c.sgg_code = ${sgg}
          ORDER BY c.id LIMIT ${take}`;
      case 'listings':
        return this.prisma.$queryRaw`
          SELECT l.id, l.updated_at AS "lastModified" FROM listings l
          WHERE ${PUBLIC_LISTING_SQL} AND l.sgg_code = ${sgg}
          ORDER BY l.published_at DESC NULLS LAST, l.id LIMIT ${take}`;
      case 'agencies':
        return this.prisma.agency
          .findMany({
            where: { status: AgencyStatus.APPROVED, deletedAt: null, sggCode: sgg },
            select: { id: true, updatedAt: true },
            orderBy: { id: 'asc' },
            take,
          })
          .then((rows) => rows.map((r) => ({ id: r.id, lastModified: r.updatedAt })));
    }
  }

  /**
   * Whether a listing that was published is still public. Never-published drafts are unknown
   * (404). Exposes no private field: only status, asset type, 단지 and 지역 (for a redirect target).
   */
  async listingStatus(id: string, now = new Date()): Promise<SeoListingStatusView> {
    const row = await this.prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assetType: true,
        complexId: true,
        emdCode: true,
        publishedAt: true,
        closedAt: true,
        expiresAt: true,
        deletedAt: true,
        primaryAgency: { select: { status: true, deletedAt: true } },
        complex: { select: { deletedAt: true } },
      },
    });
    if (!row || !row.publishedAt) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    const isPublic =
      row.deletedAt === null &&
      (PUBLIC_LISTING_STATUSES as readonly string[]).includes(row.status) &&
      row.primaryAgency.status === AgencyStatus.APPROVED &&
      row.primaryAgency.deletedAt === null;
    const expired = row.expiresAt && row.expiresAt <= now ? row.expiresAt : null;
    return {
      id: row.id,
      state: isPublic ? 'PUBLIC' : 'GONE',
      status: row.status,
      assetType: row.assetType,
      complexId: row.complex && row.complex.deletedAt === null ? row.complexId : null,
      regionCode: regionKeyOf(row.emdCode),
      endedAt: isPublic
        ? null
        : ((row.deletedAt ?? row.closedAt ?? expired)?.toISOString() ?? null),
    };
  }
}
