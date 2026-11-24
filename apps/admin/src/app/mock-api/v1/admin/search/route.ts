import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockRequireAdmin } from '@/lib/mock';
import { SEARCH_AGENCIES, SEARCH_LISTINGS, SEARCH_USERS } from './_fixtures';
import { remoteAgencies, remoteListings, remoteUsers, type CorpusRow } from './_remote';

/** Same normalisation as the list pages: case, spaces and hyphens do not matter. */
const norm = (v: unknown) =>
  (typeof v === 'string' || typeof v === 'number' ? String(v) : '')
    .toLowerCase()
    .replace(/[\s-]/g, '');

function pick<T>(rows: readonly CorpusRow<T>[], q: string, limit: number) {
  const needle = norm(q);
  const hits = rows.filter((row) => row.match.some((m) => norm(m).includes(needle)));
  return { total: hits.length, items: hits.slice(0, limit).map((row) => row.item) };
}

/** Local fixtures in corpus form (fallback when a sibling mock is unavailable). */
const local = {
  listings: SEARCH_LISTINGS.map((l) => ({
    match: [l.listingNo, l.title, l.agencyName, l.areaName] as (string | null)[],
    item: l,
  })),
  agencies: SEARCH_AGENCIES.map((a) => ({
    match: [a.name, a.representativeName, a.registrationNumber, a.areaName] as (string | null)[],
    item: a,
  })),
  users: SEARCH_USERS.map((u) => ({
    match: [u.nickname, u.name, u.email, u.phone] as (string | null)[],
    item: u,
  })),
};

/**
 * GET /api/v1/admin/search?q=&limit= — ASSUMED endpoint.
 * Grouped matches (listings by 매물번호/title, agencies, users) for the topbar search.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  if (norm(q).length < 2)
    return mockError(400, 'VALIDATION_FAILED', '검색어를 2자 이상 입력해 주세요.', [
      { path: 'q', code: 'too_small', message: '검색어를 2자 이상 입력해 주세요.' },
    ]);
  const limit = Math.min(20, Math.max(1, Number(sp.get('limit')) || 8));
  const [listings, agencies, users] = await Promise.all([
    remoteListings(req),
    remoteAgencies(req),
    remoteUsers(req),
    mockDelay(req, 120),
  ]);
  return mockJson({
    query: q,
    listings: pick<unknown>(listings ?? local.listings, q, limit),
    agencies: pick<unknown>(agencies ?? local.agencies, q, limit),
    users: pick<unknown>(users ?? local.users, q, limit),
  });
}
