import type { NextRequest } from 'next/server';
import { POPULAR_SEARCHES } from '@/features/w-content/search/popular';
import { matchRegions } from '@/features/w-content/search/targets';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { AGENCY_SUMMARIES } from '../../agencies/_fixtures';
import { COMPLEX_SPECS, toComplexDetail } from '../../complexes/_fixtures';
import { REGIONS } from '../../map/_fixtures';

const squash = (s: string | null | undefined): string =>
  (s ?? '').replace(/\s+/g, '').toLowerCase();
/** Name starts with the query → name contains it → only another field matched. */
const rank = (q: string, name: string): number => {
  const n = squash(name);
  return n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
};

const COMPLEXES = COMPLEX_SPECS.map(toComplexDetail);

// GET /api/v1/search/suggest?q&limit — ASSUMED autocomplete for the search fields (w-content owns
// the contract; w-home and w-map call it too). Public.
// → { items: [{ type: 'REGION' | 'COMPLEX' | 'AGENCY', id, label, description, lat, lng }], popular }
// Built from the same mock records as GET /regions, /complexes and /agencies, so a suggestion opens
// the same record the /search results list. An empty `q` returns no items (only `popular`).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const sp = req.nextUrl.searchParams;
  const raw = (sp.get('q') ?? '').trim().slice(0, 50);
  const q = squash(raw);
  const limit = Math.min(20, Math.max(1, Number(sp.get('limit')) || 8));
  if (q === '') return mockJson({ items: [], popular: POPULAR_SEARCHES });

  const regions = matchRegions(REGIONS, raw).map((r) => ({
    type: 'REGION' as const,
    id: r.code,
    label: r.name,
    description: ['순천시', r.parentName].filter(Boolean).join(' '),
    lat: r.lat,
    lng: r.lng,
  }));
  const complexes = COMPLEXES.filter((c) =>
    [c.name, c.emdName, c.districtName, c.roadAddress].some((f) => squash(f).includes(q)),
  )
    .sort((a, b) => rank(q, a.name) - rank(q, b.name))
    .map((c) => ({
      type: 'COMPLEX' as const,
      id: c.id,
      label: c.name,
      description: [c.emdName, c.households ? `${c.households.toLocaleString('ko-KR')}세대` : null]
        .filter(Boolean)
        .join(' · '),
      lat: c.lat,
      lng: c.lng,
    }));
  const agencies = AGENCY_SUMMARIES.filter((a) =>
    [a.name, a.roadAddress, a.tagline].some((f) => squash(f).includes(q)),
  )
    .sort((a, b) => rank(q, a.name) - rank(q, b.name))
    .map((a) => ({
      type: 'AGENCY' as const,
      id: a.id,
      label: a.name,
      description: a.roadAddress.replace(/^(전라남도|전남)\s+/, ''),
      lat: a.lat,
      lng: a.lng,
    }));

  return mockJson({
    items: [...regions, ...complexes, ...agencies].slice(0, limit),
    popular: POPULAR_SEARCHES,
  });
}
