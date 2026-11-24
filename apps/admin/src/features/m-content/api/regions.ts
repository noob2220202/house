'use client';
import { DEFAULT_SGG_CODE } from '@house/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api, qk } from '@/lib/api';

const regionSchema = z.object({
  code: z.string(),
  name: z.string(),
  parentName: z.string().nullable().default(null),
});
export type Region = z.infer<typeof regionSchema>;

/** Bare `RegionView[]` (the API); `{ items }` is still accepted. */
const regionsSchema = z
  .union([z.object({ items: z.array(regionSchema) }), z.array(regionSchema)])
  .transform((v) => (Array.isArray(v) ? v : v.items));

export const regionLabel = (r: Region) => (r.parentName ? `${r.parentName} ${r.name}` : r.name);

/**
 * 읍면동 of 순천시 — GET /regions (complexes module; `RegionView[]`, default parent = the service
 * 시군구 `DEFAULT_SGG_CODE`).
 */
export function useRegions() {
  return useQuery({
    queryKey: qk('regions', 'list', DEFAULT_SGG_CODE),
    queryFn: ({ signal }) => api.get('/regions', { schema: regionsSchema, signal }),
    staleTime: 10 * 60_000,
  });
}
