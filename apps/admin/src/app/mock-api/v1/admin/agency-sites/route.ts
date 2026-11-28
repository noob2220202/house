import { AgencySiteStatus, adminAgencySiteListQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate, validationError } from '@/features/m-moderation/mock/handler';
import { mockJson, mockPaginate } from '@/lib/mock';
import { sitesDb, toSiteListItem } from './_fixtures';

// GET /api/v1/admin/agency-sites?status&q&page&pageSize → Paginated<AdminAgencySiteListItem>.
// REQUESTED is the approval queue (oldest request first); the other states read the newest
// decision first. `q` matches the office name, 대표 and the approved / requested slug.
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const parsed = adminAgencySiteListQuerySchema.safeParse({
    status: sp.get('status') ?? undefined,
    q: sp.get('q') || undefined,
  });
  if (!parsed.success) return validationError('status', '홈페이지 상태가 올바르지 않습니다.');
  const { status, q } = parsed.data;
  const rows = sitesDb()
    .filter((s) => !status || s.status === status)
    .map((s) => toSiteListItem(s))
    .filter((r) => r !== null)
    .filter((r) =>
      matches(
        q ?? '',
        r.agency.name,
        r.agency.representativeName,
        r.site.slug,
        r.site.requestedSlug,
      ),
    )
    .sort((a, b) =>
      status === AgencySiteStatus.REQUESTED
        ? a.site.requestedAt.localeCompare(b.site.requestedAt)
        : (b.site.decidedAt ?? b.site.requestedAt).localeCompare(
            a.site.decidedAt ?? a.site.requestedAt,
          ),
    );
  return mockJson(mockPaginate(rows, req));
}
