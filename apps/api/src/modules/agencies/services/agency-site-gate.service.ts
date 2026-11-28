import {
  SUBSCRIPTION_REQUIRED_FEATURE,
  SiteSettingKey,
  SubscriptionProduct,
  kstDate,
  siteUrl,
  type AgencySiteSubscriptionStatus,
  type SiteSlugProblem,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { FEATURES_CACHE_TTL_SECONDS } from '../constants';
import {
  adminHostLabel,
  dateOnly,
  siteSlugProblemFor,
  subscriptionStatus,
  toDbDate,
  type SiteContext,
} from '../domain/sites';
import { AgencyCacheService } from './agency-cache.service';

/**
 * What a 사무소 홈페이지 needs besides its own row to be served or linked: the office host URLs
 * (SITE_ROOT_DOMAIN + PUBLIC_BASE_URL's protocol/port), https readiness in dev, and the
 * subscription gate (FEATURES.siteSubscriptionRequired + ACTIVE SITE subscriptions in KST days).
 *
 * Exported: the admin module calls `featuresChanged()` after a FEATURES write, because the gate
 * is part of every cached public agency read (profile `site`, GET /sites/:slug).
 */
@Injectable()
export class AgencySiteGateService {
  private readonly base: URL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AgencyCacheService,
    private readonly config: AppConfig,
  ) {
    this.base = new URL(config.get('PUBLIC_BASE_URL'));
  }

  get rootDomain(): string {
    return this.config.siteRootDomain;
  }

  /** `https://<slug>.<root>` (dev: `http://<slug>.localhost:3000`). */
  urlFor(slug: string): string {
    return siteUrl(slug, this.rootDomain, this.base.protocol, this.base.port || null);
  }

  /**
   * The slug rules of this deployment: the shared format + RESERVED_SITE_SLUGS, plus the first
   * label of ADMIN_BASE_URL's host (an `--admin-subdomain` such as `manage` is never servable as
   * an office host — deploy/sites.sh refuses it as ADMIN_HOST — so it counts as RESERVED).
   */
  slugProblem(slug: string): SiteSlugProblem | null {
    return siteSlugProblemFor(slug, adminHostLabel(this.config.get('ADMIN_BASE_URL')));
  }

  /** Without https on the main site (dev) there is no certificate to wait for. */
  get httpsAlways(): boolean {
    return this.base.protocol !== 'https:';
  }

  /**
   * FEATURES flags (site setting, written by the admin module; the agencies module only reads
   * it — AdminModule imports AgenciesModule, so it cannot be injected the other way). Cached in
   * the public agency namespace, which `featuresChanged()` bumps.
   */
  async features(): Promise<Record<string, boolean>> {
    const key = await this.cache.publicKey('features');
    return this.cache.getOrSet(key, FEATURES_CACHE_TTL_SECONDS, async () => {
      const row = await this.prisma.siteSetting.findUnique({
        where: { key: SiteSettingKey.FEATURES },
        select: { value: true },
      });
      const value = row?.value;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries(
        Object.entries(value).filter((e): e is [string, boolean] => typeof e[1] === 'boolean'),
      );
    });
  }

  async siteSubscriptionRequired(): Promise<boolean> {
    return (await this.features())[SUBSCRIPTION_REQUIRED_FEATURE.SITE] === true;
  }

  /** Called after FEATURES changes: every cached public site / profile is recomputed. */
  featuresChanged(): Promise<void> {
    return this.cache.invalidatePublic();
  }

  /**
   * Last days of the subscriptions of `product` covering `today` (KST) per agency: not canceled,
   * startsOn ≤ today ≤ endsOn (or open-ended). An agency without one is absent from the map.
   */
  async activeEnds(
    agencyIds: readonly string[],
    product: SubscriptionProduct,
    now = new Date(),
    db: PrismaTx = this.prisma,
  ): Promise<Map<string, (string | null)[]>> {
    const out = new Map<string, (string | null)[]>();
    if (agencyIds.length === 0) return out;
    const today = toDbDate(kstDate(now));
    const rows = await db.agencySubscription.findMany({
      where: {
        agencyId: { in: [...new Set(agencyIds)] },
        product,
        canceledAt: null,
        startsOn: { lte: today },
        OR: [{ endsOn: null }, { endsOn: { gte: today } }],
      },
      select: { agencyId: true, endsOn: true },
    });
    for (const r of rows) {
      const list = out.get(r.agencyId) ?? [];
      list.push(r.endsOn ? dateOnly(r.endsOn) : null);
      out.set(r.agencyId, list);
    }
    return out;
  }

  /** The console's SITE subscription line of each agency, plus whether the gate passes. */
  async siteSubscriptions(
    agencyIds: readonly string[],
    now = new Date(),
    db: PrismaTx = this.prisma,
  ): Promise<Map<string, AgencySiteSubscriptionStatus>> {
    const [required, ends] = await Promise.all([
      this.siteSubscriptionRequired(),
      this.activeEnds(agencyIds, SubscriptionProduct.SITE, now, db),
    ]);
    return new Map(agencyIds.map((id) => [id, subscriptionStatus(required, ends.get(id) ?? [])]));
  }

  async siteSubscription(
    agencyId: string,
    now = new Date(),
    db: PrismaTx = this.prisma,
  ): Promise<AgencySiteSubscriptionStatus> {
    const map = await this.siteSubscriptions([agencyId], now, db);
    return map.get(agencyId) ?? { required: false, active: false, endsOn: null };
  }

  /** Context of `toSiteView` / `isSiteLive` for one agency. */
  context(agencyLive: boolean, subscription: AgencySiteSubscriptionStatus): SiteContext {
    return {
      urlFor: (slug) => this.urlFor(slug),
      httpsAlways: this.httpsAlways,
      agencyLive,
      subscriptionOk: !subscription.required || subscription.active,
    };
  }
}
