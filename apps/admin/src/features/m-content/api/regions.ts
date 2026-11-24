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

/** `{ items }` or a bare array — same leniency as the user site (docs/frontend-integration/w-map.md). */
const regionsSchema = z
  .union([z.object({ items: z.array(regionSchema) }), z.array(regionSchema)])
  .transform((v) => (Array.isArray(v) ? v : v.items));

export const regionLabel = (r: Region) => (r.parentName ? `${r.parentName} ${r.name}` : r.name);

/** 읍면동 / 지구 of 순천시 — ASSUMED public endpoint GET /regions?sggCode (first assumed by w-map). */
export function useRegions() {
  return useQuery({
    queryKey: qk('regions', 'list', DEFAULT_SGG_CODE),
    queryFn: ({ signal }) =>
      api.get('/regions', { query: { sggCode: DEFAULT_SGG_CODE }, schema: regionsSchema, signal }),
    staleTime: 10 * 60_000,
  });
}
