import type { NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * MOCK ONLY. The real `GET /admin/dashboard*` endpoints aggregate data owned by other modules.
 * The mock does the same over HTTP against the sibling mock resources (agencies · deal requests ·
 * reports → m-moderation, banners → m-ads, stats → m-content) so the dashboard, the management
 * pages and the stats page show the same numbers and every dashboard row opens something that
 * exists there — and falls back to its own fixtures when a sibling mock is missing or fails.
 */
export async function selfGet(req: NextRequest, path: string): Promise<unknown> {
  try {
    // `_delay=1` skips the sibling's artificial latency: this is a server → server call.
    const url = `${req.nextUrl.origin}/mock-api/v1${path}${path.includes('?') ? '&' : '?'}_delay=1`;
    const res = await fetch(url, {
      headers: { cookie: req.headers.get('cookie') ?? '', accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

const REQUIRED_DOCS = ['REGISTRATION_CERT', 'BUSINESS_REG_CERT', 'OTHER'] as const;
/** In the agencies mock the third required paper (공제증서) is stored under the OTHER type. */
const OTHER_LABEL = '공제증서';

const agencyPageSchema = z.object({
  total: z.number().int().min(0),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      representativeName: z.string(),
      registrationNumber: z.string(),
      emdName: z.string().nullish(),
      status: z.string(),
      createdAt: z.string(),
      documentTypes: z.array(z.string()).default([]),
      registryStatus: z.string().nullish(),
    }),
  ),
});

export interface RemotePendingAgency {
  id: string;
  name: string;
  areaName: string | null;
  representativeName: string;
  registrationNumber: string;
  status: string;
  appliedAt: string;
  documents: {
    submitted: number;
    required: number;
    missing: string[];
    missingLabel: string | null;
  };
  /** Copied from the agencies mock, so the dashboard and /agencies apply the same approval rule. */
  registryStatus: string | null;
}

/** Pending applications from GET /admin/agencies?status=PENDING (oldest first), or null. */
export async function remotePendingAgencies(
  req: NextRequest,
): Promise<{ total: number; items: RemotePendingAgency[] } | null> {
  const parsed = agencyPageSchema.safeParse(
    await selfGet(req, '/admin/agencies?status=PENDING&pageSize=50'),
  );
  if (!parsed.success) return null;
  const items = parsed.data.items
    .filter((a) => a.status === 'PENDING')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => {
      const missing = REQUIRED_DOCS.filter((d) => !a.documentTypes.includes(d));
      return {
        id: a.id,
        name: a.name,
        areaName: a.emdName ?? null,
        representativeName: a.representativeName,
        registrationNumber: a.registrationNumber,
        status: a.status,
        appliedAt: a.createdAt,
        documents: {
          submitted: REQUIRED_DOCS.length - missing.length,
          required: REQUIRED_DOCS.length,
          missing: missing.filter((d) => d !== 'OTHER'),
          missingLabel: missing.includes('OTHER') ? OTHER_LABEL : null,
        },
        registryStatus: a.registryStatus ?? null,
      };
    });
  return { total: Math.max(parsed.data.total, items.length), items };
}

// ---------- 사무소 홈페이지 신청 (m-moderation mock) ----------

const sitePageSchema = z.object({
  total: z.number().int().min(0),
  items: z.array(
    z.object({
      site: z.object({
        status: z.string(),
        requestedSlug: z.string().nullish(),
        requestedAt: z.string(),
      }),
      agency: z.object({ id: z.string(), name: z.string() }),
    }),
  ),
});

export interface RemotePendingSite {
  agencyId: string;
  agencyName: string;
  requestedSlug: string | null;
  requestedAt: string;
}

/** 사무소 홈페이지 requests from GET /admin/agency-sites?status=REQUESTED (oldest first), or null. */
export async function remotePendingSites(
  req: NextRequest,
): Promise<{ total: number; items: RemotePendingSite[] } | null> {
  const parsed = sitePageSchema.safeParse(
    await selfGet(req, '/admin/agency-sites?status=REQUESTED&pageSize=50'),
  );
  if (!parsed.success) return null;
  const items = parsed.data.items
    .filter((r) => r.site.status === 'REQUESTED')
    .sort((a, b) => a.site.requestedAt.localeCompare(b.site.requestedAt))
    .map((r) => ({
      agencyId: r.agency.id,
      agencyName: r.agency.name,
      requestedSlug: r.site.requestedSlug ?? null,
      requestedAt: r.site.requestedAt,
    }));
  return { total: Math.max(parsed.data.total, items.length), items };
}

const trafficSchema = z.object({
  points: z.array(z.object({ visitors: z.number().int().min(0) })).min(2),
});

/** Today's / yesterday's unique visitors from GET /admin/stats/traffic, or null. */
export async function remoteVisitors(
  req: NextRequest,
): Promise<{ today: number; yesterday: number } | null> {
  const parsed = trafficSchema.safeParse(await selfGet(req, '/admin/stats/traffic?days=7'));
  if (!parsed.success) return null;
  const { points } = parsed.data;
  return {
    today: points[points.length - 1]!.visitors,
    yesterday: points[points.length - 2]!.visitors,
  };
}

const DAY_MS = 86_400_000;
/** Ads ending within this many days are "만료 임박" (the advertiser reminder goes out at D-7). */
export const EXPIRING_WITHIN_DAYS = 7;

const bannerPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      slot: z.string(),
      title: z.string(),
      advertiserName: z.string().nullish(),
      agency: z.object({ name: z.string() }).nullish(),
      endAt: z.string(),
      status: z.string(),
      impressions: z.number().min(0).default(0),
      clicks: z.number().min(0).default(0),
      pcMedia: z
        .object({
          variants: z.object({ thumb: z.object({ url: z.string() }).nullish() }).nullish(),
        })
        .nullish(),
    }),
  ),
});

export interface RemoteExpiringAd {
  id: string;
  kind: 'BANNER';
  advertiserName: string;
  slot: string;
  placementLabel: string | null;
  endAt: string;
  ctr: number | null;
  imageUrl: string | null;
}

/**
 * Live banners that end within a week, soonest first, from GET /admin/banners?status=ACTIVE
 * (m-ads mock) — so "연장 처리" opens a banner that really exists there. Null when unavailable.
 */
export async function remoteExpiringAds(
  req: NextRequest,
  now = Date.now(),
): Promise<{ total: number; items: RemoteExpiringAd[] } | null> {
  const parsed = bannerPageSchema.safeParse(
    await selfGet(req, '/admin/banners?status=ACTIVE&pageSize=100'),
  );
  if (!parsed.success) return null;
  const kstDay = (t: number) => Math.floor((t + 9 * 3_600_000) / DAY_MS);
  const items = parsed.data.items
    .filter((b) => {
      const end = Date.parse(b.endAt);
      if (Number.isNaN(end)) return false;
      const days = kstDay(end) - kstDay(now);
      return days >= 0 && days <= EXPIRING_WITHIN_DAYS;
    })
    .sort((a, b) => a.endAt.localeCompare(b.endAt))
    .map((b) => ({
      id: b.id,
      kind: 'BANNER' as const,
      // Office ads have no advertiser text: the office (or the creative title) names the row.
      advertiserName: b.advertiserName || b.agency?.name || b.title,
      slot: b.slot,
      placementLabel: null,
      endAt: b.endAt,
      ctr: b.impressions > 0 ? Math.min(1, b.clicks / b.impressions) : null,
      imageUrl: b.pcMedia?.variants?.thumb?.url ?? null,
    }));
  return { total: items.length, items };
}

// ---------- 내놓기·구하기 (m-moderation mock) ----------

const num = z.number().nullish();
const dealRequestPageSchema = z.object({
  total: z.number().int().min(0),
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['SELL_OR_LEASE', 'WANTED']),
      assetType: z.string().nullish(),
      dealTypes: z.array(z.string()).default([]),
      complexName: z.string().nullish(),
      emdName: z.string().nullish(),
      exclusiveArea: num,
      desiredSalePrice: num,
      desiredDeposit: num,
      desiredMonthlyRent: num,
      regionNames: z.array(z.string()).default([]),
      priceMax: num,
      depositMax: num,
      rentMax: num,
      areaMin: num,
      areaMax: num,
      targetAgencyCount: z.number().default(0),
      proposalCount: z.number().default(0),
      spamFlaggedAt: z.string().nullish(),
      createdAt: z.string(),
    }),
  ),
});
type RemoteDealRequestRow = z.infer<typeof dealRequestPageSchema>['items'][number];

const ASSET_LABEL: Record<string, string> = {
  APT: '아파트',
  ONEROOM: '원룸·투룸',
  HOUSE: '주택',
  COMMERCIAL: '상가·업무',
  LAND: '토지',
};

function dealRequestTitleOf(r: RemoteDealRequestRow): string {
  const area = (v: number) => `전용 ${Math.round(v)}㎡`;
  if (r.type === 'SELL_OR_LEASE') {
    const place = r.complexName ?? r.emdName ?? '순천시';
    const kind = r.complexName ? null : (ASSET_LABEL[r.assetType ?? ''] ?? null);
    return [kind ? `${place} ${kind}` : place, r.exclusiveArea ? area(r.exclusiveArea) : null]
      .filter(Boolean)
      .join(' · ');
  }
  const regions =
    r.regionNames.length > 2
      ? `${r.regionNames.slice(0, 2).join('·')} 외 ${r.regionNames.length - 2}곳`
      : r.regionNames.join('·') || '순천시';
  const size =
    r.areaMin && r.areaMax
      ? area((r.areaMin + r.areaMax) / 2)
      : r.areaMin
        ? `${area(r.areaMin)} 이상`
        : r.areaMax
          ? `${area(r.areaMax)} 이하`
          : (ASSET_LABEL[r.assetType ?? ''] ?? null);
  return [regions, size].filter(Boolean).join(' · ');
}

export interface RemoteDealRequests {
  /** Open, not spam-flagged requests. */
  total: number;
  items: Record<string, unknown>[];
  kpi: { today: number; sell: number; find: number; unassigned: number };
}

/** Open requests from GET /admin/deal-requests?status=OPEN (newest first), or null. */
export async function remoteDealRequests(
  req: NextRequest,
  now = Date.now(),
): Promise<RemoteDealRequests | null> {
  const parsed = dealRequestPageSchema.safeParse(
    await selfGet(req, '/admin/deal-requests?status=OPEN&pageSize=100'),
  );
  if (!parsed.success) return null;
  const kstDay = (t: number) => Math.floor((t + 9 * 3_600_000) / DAY_MS);
  const open = parsed.data.items
    .filter((r) => !r.spamFlaggedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = open.filter((r) => kstDay(Date.parse(r.createdAt)) === kstDay(now));
  const int = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v) : null);
  return {
    total: open.length,
    kpi: {
      today: today.length,
      sell: today.filter((r) => r.type === 'SELL_OR_LEASE').length,
      find: today.filter((r) => r.type === 'WANTED').length,
      unassigned: open.filter((r) => r.targetAgencyCount === 0).length,
    },
    items: open.slice(0, 5).map((r) => {
      const sell = r.type === 'SELL_OR_LEASE';
      return {
        id: r.id,
        type: r.type,
        title: dealRequestTitleOf(r),
        dealType: r.dealTypes[0] ?? 'SALE',
        price: int(sell ? r.desiredSalePrice : r.priceMax),
        deposit: int(sell ? r.desiredDeposit : r.depositMax),
        monthlyRent: int(sell ? r.desiredMonthlyRent : r.rentMax),
        note: null,
        createdAt: r.createdAt,
        deliveredAgencyCount: r.targetAgencyCount,
        activeProposalCount: r.proposalCount,
      };
    }),
  };
}

// ---------- 신고 (m-moderation mock) ----------

const reportPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      targetType: z.enum(['LISTING', 'AGENCY']),
      reason: z.string(),
      status: z.string(),
      createdAt: z.string(),
      handledAt: z.string().nullish(),
      listing: z
        .object({
          id: z.string(),
          title: z.string().nullish(),
          complexName: z.string().nullish(),
          buildingName: z.string().nullish(),
          dealType: z.string().nullish(),
          salePrice: num,
          deposit: num,
          monthlyRent: num,
          presalePrice: num,
        })
        .nullish(),
      agency: z.object({ id: z.string(), name: z.string() }).nullish(),
      sameTargetCount: z.number().default(1),
    }),
  ),
});

const manwon = (v: number) => {
  const eok = Math.floor(v / 10_000);
  const rest = v % 10_000;
  const r = rest.toLocaleString('ko-KR');
  return eok === 0 ? r : rest === 0 ? `${eok}억` : `${eok}억 ${r}`;
};

function listingHeadline(
  l: NonNullable<z.infer<typeof reportPageSchema>['items'][number]['listing']>,
) {
  const name = l.complexName ?? l.buildingName ?? l.title ?? '매물';
  if (l.dealType === 'MONTHLY' && typeof l.monthlyRent === 'number')
    return `${name} 월세 ${manwon(l.deposit ?? 0)}/${l.monthlyRent.toLocaleString('ko-KR')}`;
  if (l.dealType === 'JEONSE' && typeof l.deposit === 'number')
    return `${name} 전세 ${manwon(l.deposit)}`;
  if (l.dealType === 'PRESALE' && typeof l.presalePrice === 'number')
    return `${name} 분양권 ${manwon(l.presalePrice)}`;
  if (typeof l.salePrice === 'number') return `${name} 매매 ${manwon(l.salePrice)}`;
  return name;
}

export interface RemoteReports {
  /** Open reports (RECEIVED / IN_REVIEW). */
  open: number;
  /** One row per reported target, most recently reported first. */
  total: number;
  items: Record<string, unknown>[];
  handledThisWeek: number;
  avgHandleHours: number | null;
}

/** Report queue + handling stats from GET /admin/reports (all statuses), or null. */
export async function remoteReports(
  req: NextRequest,
  now = Date.now(),
): Promise<RemoteReports | null> {
  const parsed = reportPageSchema.safeParse(await selfGet(req, '/admin/reports?pageSize=100'));
  if (!parsed.success) return null;
  const all = parsed.data.items;
  const open = all
    .filter((r) => r.status === 'RECEIVED' || r.status === 'IN_REVIEW')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  const targets = open.filter((r) => {
    const key =
      r.targetType === 'LISTING' ? `L:${r.listing?.id ?? r.id}` : `A:${r.agency?.id ?? r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const handled = all.filter((r) => {
    const at = r.handledAt ? Date.parse(r.handledAt) : NaN;
    return !Number.isNaN(at) && now - at <= 7 * DAY_MS;
  });
  const hours = handled.map(
    (r) => (Date.parse(r.handledAt!) - Date.parse(r.createdAt)) / 3_600_000,
  );
  return {
    open: open.length,
    total: targets.length,
    handledThisWeek: handled.length,
    avgHandleHours:
      hours.length > 0
        ? Math.max(0, Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10)
        : null,
    items: targets.slice(0, 3).map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetType === 'LISTING' ? (r.listing?.id ?? r.id) : (r.agency?.id ?? r.id),
      reason: r.reason,
      title: r.listing ? listingHeadline(r.listing) : (r.agency?.name ?? '중개사무소'),
      agencyName: r.listing ? (r.agency?.name ?? null) : null,
      reportCount: open.filter((x) =>
        r.targetType === 'LISTING'
          ? x.listing?.id === r.listing?.id
          : x.targetType === 'AGENCY' && x.agency?.id === r.agency?.id,
      ).length,
      lastReportedAt: r.createdAt,
    })),
  };
}
