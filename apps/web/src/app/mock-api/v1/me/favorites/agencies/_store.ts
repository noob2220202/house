import type { MockRole } from '@/lib/mock';

/**
 * 관심 중개사무소 of the mock sessions (w-agencies). Kept separate from `me/_store.ts` (w-me) so the
 * two groups never edit the same file; one bucket per mock role, in memory while the dev server runs.
 */
const KEY = '__houseMockFavoriteAgencies_v1';
type Buckets = Partial<Record<MockRole, { id: string; at: string }[]>>;

export function favoriteAgencies(role: MockRole): { id: string; at: string }[] {
  const g = globalThis as typeof globalThis & { [KEY]?: Buckets };
  g[KEY] ??= {};
  g[KEY][role] ??= [];
  return g[KEY][role];
}
