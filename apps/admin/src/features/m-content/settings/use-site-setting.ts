'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { qk } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { siteSettings } from '../api';
import { useDevQuery } from '../api/dev';

/**
 * One site-setting key (GET/PUT /admin/site-settings/:key): the stored value (null until first
 * saved) and a save mutation that writes the answer back into the query cache.
 */
export function useSiteSetting<S extends z.ZodType>(key: string, schema: S) {
  const dev = useDevQuery();
  const queryClient = useQueryClient();
  const queryKey = qk('admin-site-settings', key, dev);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => siteSettings.get(key, schema, dev, { signal }),
  });
  const save = useMutation({
    mutationFn: (body: unknown) => siteSettings.put(key, schema, body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });
  return { query, save };
}

/** "2026.11.02 10:12 · 정다은 저장" for the save bar; a hint when the key was never saved. */
export function settingSavedLabel(
  setting:
    | {
        updatedAt: string | null;
        updatedByAdminName: string | null;
      }
    | undefined,
): string {
  if (!setting?.updatedAt) return '아직 저장한 적이 없어요';
  return `${formatDateTime(setting.updatedAt)} · ${setting.updatedByAdminName ?? '알 수 없음'} 저장`;
}
