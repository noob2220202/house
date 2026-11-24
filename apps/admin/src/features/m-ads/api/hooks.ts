'use client';
import type { BannerSlot, BannerStatus, MediaPurpose } from '@house/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, ApiError, qk } from '@/lib/api';
import { pollUntil } from '../lib/poll';
import { fallbackSlots } from '../lib/slots';
import { mergeVisibleOrder, placeAt, sameOrder } from '../lib/reorder';
import {
  adminBannerPageSchema,
  adminBannerSchema,
  adminPopupPageSchema,
  adminPopupSchema,
  agencyOptionPageSchema,
  bannerSlotListSchema,
  bannerSlotSchema,
  bannerStatsSchema,
  complexOptionPageSchema,
  mediaSchema,
  mediaUrl,
  regionListSchema,
  type AdminBanner,
  type AdminBannerPage,
  type AdminPopup,
  type AdminPopupPage,
  type BannerSlotInfo,
} from './schemas';

/** Query keys: [resource, scope, params] (see @/lib/api `qk`). */
export const BANNERS = 'admin-banners';
export const SLOTS = 'admin-banner-slots';
export const POPUPS = 'admin-popups';

export interface BannerListParams {
  slot?: BannerSlot;
  status?: BannerStatus;
  q?: string;
  page: number;
  pageSize: number;
}

export const BANNER_PAGE_SIZE = 10;
const ALL_PAGE_SIZE = 100;

export function useBannerList(params: BannerListParams) {
  return useQuery({
    queryKey: qk(BANNERS, 'list', params),
    queryFn: ({ signal }) =>
      api.get('/admin/banners', { query: { ...params }, schema: adminBannerPageSchema, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useBanner(id: string | null) {
  return useQuery({
    queryKey: qk(BANNERS, 'detail', id),
    queryFn: ({ signal }) => api.get(`/admin/banners/${id}`, { schema: adminBannerSchema, signal }),
    enabled: !!id,
  });
}

const slotAllKey = (slot: BannerSlot) => qk(BANNERS, 'slot-all', slot);
const fetchSlotBanners = (slot: BannerSlot, signal?: AbortSignal) =>
  api.get('/admin/banners', {
    query: { slot, page: 1, pageSize: ALL_PAGE_SIZE },
    schema: adminBannerPageSchema,
    signal,
  });

/** Every banner of one slot in display order (order select of the editor, reorder). */
export function useSlotBanners(slot: BannerSlot | null) {
  return useQuery({
    queryKey: slot ? slotAllKey(slot) : qk(BANNERS, 'slot-all', null),
    queryFn: ({ signal }) => fetchSlotBanners(slot as BannerSlot, signal),
    enabled: !!slot,
  });
}

/**
 * Slot overview. `GET /admin/banner-slots` is listed as ADMIN+ in the ads README; when an OPERATOR
 * gets a 403 the shared defaults are used (limits without live counts).
 */
export function useBannerSlots() {
  return useQuery({
    queryKey: qk(SLOTS, 'list'),
    queryFn: async ({ signal }): Promise<BannerSlotInfo[]> => {
      try {
        const res = await api.get('/admin/banner-slots', { schema: bannerSlotListSchema, signal });
        return res.items;
      } catch (error) {
        if (error instanceof ApiError && error.isForbidden) return fallbackSlots();
        throw error;
      }
    },
  });
}

export interface StatsRange {
  from?: string;
  to?: string;
}

export function useBannerStats(id: string, range: StatsRange) {
  return useQuery({
    queryKey: qk(BANNERS, 'stats', { id, ...range }),
    queryFn: ({ signal }) =>
      api.get(`/admin/banners/${id}/stats`, {
        query: { from: range.from, to: range.to },
        schema: bannerStatsSchema,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

function invalidateBanners(client: QueryClient) {
  void client.invalidateQueries({ queryKey: [BANNERS] });
  void client.invalidateQueries({ queryKey: [SLOTS] });
}

/** PUT /admin/banners/reorder (`bannerReorderSchema`) with the complete id order of one slot. */
async function putSlotOrder(slot: BannerSlot, ids: string[]) {
  await api.put('/admin/banners/reorder', { slot, ids });
}

/**
 * Create / update a banner, then move it to the chosen position of its slot when that differs from
 * where the backend put it (new banners are appended; a slot change appends too). `position: null`
 * keeps the backend's place.
 */
export function useSaveBanner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      input: Record<string, unknown>;
      position: number | null;
    }): Promise<AdminBanner> => {
      const saved = vars.id
        ? await api.patch(`/admin/banners/${vars.id}`, vars.input, { schema: adminBannerSchema })
        : await api.post('/admin/banners', vars.input, { schema: adminBannerSchema });
      if (vars.position !== null && saved.sortOrder !== vars.position) {
        const all = await fetchSlotBanners(saved.slot);
        const current = all.items.map((b) => b.id);
        const next = placeAt(current, saved.id, vars.position);
        if (!sameOrder(current, next)) await putSlotOrder(saved.slot, next);
      }
      return saved;
    },
    onSettled: () => invalidateBanners(client),
  });
}

/** Pause / resume from the list (optimistic). */
export function useToggleBanner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; paused: boolean }) =>
      api.patch(
        `/admin/banners/${vars.id}`,
        { paused: vars.paused },
        { schema: adminBannerSchema },
      ),
    onMutate: async (vars) => {
      await client.cancelQueries({ queryKey: [BANNERS, 'list'] });
      const snapshot = client.getQueriesData<AdminBannerPage>({ queryKey: [BANNERS, 'list'] });
      client.setQueriesData<AdminBannerPage>({ queryKey: [BANNERS, 'list'] }, (page) =>
        page
          ? {
              ...page,
              items: page.items.map((b) => (b.id === vars.id ? { ...b, paused: vars.paused } : b)),
            }
          : page,
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
    },
    onSettled: () => invalidateBanners(client),
  });
}

export function useDeleteBanner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/banners/${id}`),
    onSettled: () => invalidateBanners(client),
  });
}

const BANNER_REORDER_KEY = [BANNERS, 'reorder'] as const;

/**
 * Drag / keyboard reorder: `visibleIds` is the new order of the rows of ONE slot that are on screen.
 * The complete slot order is fetched fresh and the visible rows are re-placed inside it.
 *
 * Moves made in quick succession run one after another (`scope`): each one reads the order the
 * previous one wrote, so a second move is never computed from a stale list and lost. The lists are
 * only refetched after the last queued move, which keeps the optimistic order on screen meanwhile.
 */
export function useReorderBanners() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: BANNER_REORDER_KEY,
    scope: { id: 'ads-banner-reorder' },
    mutationFn: async (vars: { slot: BannerSlot; visibleIds: string[] }) => {
      const all = await fetchSlotBanners(vars.slot);
      const current = all.items.map((b) => b.id);
      const next = mergeVisibleOrder(current, vars.visibleIds);
      if (!sameOrder(current, next)) await putSlotOrder(vars.slot, next);
    },
    onSettled: () => {
      // This mutation still counts as pending here: 1 = nothing else is queued behind it.
      if (client.isMutating({ mutationKey: BANNER_REORDER_KEY }) <= 1) invalidateBanners(client);
    },
  });
}

export function useUpdateSlotLimit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { slot: BannerSlot; maxActive: number }) =>
      api.patch(
        `/admin/banner-slots/${vars.slot}`,
        { maxActive: vars.maxActive },
        { schema: bannerSlotSchema },
      ),
    onSettled: () => void client.invalidateQueries({ queryKey: [SLOTS] }),
  });
}

// ---- popups ----------------------------------------------------------------------------------------

export function usePopupList(status?: BannerStatus) {
  return useQuery({
    queryKey: qk(POPUPS, 'list', { status: status ?? null }),
    queryFn: ({ signal }) =>
      api.get('/admin/popups', {
        query: { status, page: 1, pageSize: ALL_PAGE_SIZE },
        schema: adminPopupPageSchema,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function usePopup(id: string | null) {
  return useQuery({
    queryKey: qk(POPUPS, 'detail', id),
    queryFn: ({ signal }) => api.get(`/admin/popups/${id}`, { schema: adminPopupSchema, signal }),
    enabled: !!id,
  });
}

const fetchAllPopups = () =>
  api.get('/admin/popups', {
    query: { page: 1, pageSize: ALL_PAGE_SIZE },
    schema: adminPopupPageSchema,
  });

export function useSavePopup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string | null;
      input: Record<string, unknown>;
      /** `null` keeps the place the backend gave. */
      position: number | null;
    }): Promise<AdminPopup> => {
      const saved = vars.id
        ? await api.patch(`/admin/popups/${vars.id}`, vars.input, { schema: adminPopupSchema })
        : await api.post('/admin/popups', vars.input, { schema: adminPopupSchema });
      if (vars.position !== null && saved.sortOrder !== vars.position) {
        const current = (await fetchAllPopups()).items.map((p) => p.id);
        const next = placeAt(current, saved.id, vars.position);
        if (!sameOrder(current, next)) await api.put('/admin/popups/reorder', { ids: next });
      }
      return saved;
    },
    onSettled: () => void client.invalidateQueries({ queryKey: [POPUPS] }),
  });
}

/** Partial update from the list / quick panel (optimistic). */
export function usePatchPopup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Partial<AdminPopup> }) =>
      api.patch(`/admin/popups/${vars.id}`, vars.patch, { schema: adminPopupSchema }),
    onMutate: async (vars) => {
      await client.cancelQueries({ queryKey: [POPUPS, 'list'] });
      const snapshot = client.getQueriesData<AdminPopupPage>({ queryKey: [POPUPS, 'list'] });
      client.setQueriesData<AdminPopupPage>({ queryKey: [POPUPS, 'list'] }, (page) =>
        page
          ? {
              ...page,
              items: page.items.map((p) => (p.id === vars.id ? { ...p, ...vars.patch } : p)),
            }
          : page,
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
    },
    onSettled: () => void client.invalidateQueries({ queryKey: [POPUPS] }),
  });
}

export function useDeletePopup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/popups/${id}`),
    onSettled: () => void client.invalidateQueries({ queryKey: [POPUPS] }),
  });
}

const POPUP_REORDER_KEY = [POPUPS, 'reorder'] as const;

/** Popup reorder — serialized like `useReorderBanners`. */
export function useReorderPopups() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: POPUP_REORDER_KEY,
    scope: { id: 'ads-popup-reorder' },
    mutationFn: async (vars: { visibleIds: string[] }) => {
      const current = (await fetchAllPopups()).items.map((p) => p.id);
      const next = mergeVisibleOrder(current, vars.visibleIds);
      if (!sameOrder(current, next)) await api.put('/admin/popups/reorder', { ids: next });
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: POPUP_REORDER_KEY }) <= 1)
        void client.invalidateQueries({ queryKey: [POPUPS] });
    },
  });
}

// ---- media + pickers -------------------------------------------------------------------------------

/** POST /admin/media?purpose= (multipart `file`) → MediaDto. */
export function uploadAdminMedia(file: File, purpose: MediaPurpose, signal?: AbortSignal) {
  const body = new FormData();
  body.append('file', file);
  return api.post('/admin/media', body, {
    query: { purpose },
    schema: mediaSchema,
    signal,
    timeoutMs: 60_000,
  });
}

/**
 * Uploads an ad image and waits until it can be shown. The media module creates the webp variants
 * in a background job (PENDING → READY), so the upload response may come back without variant URLs;
 * the public metadata endpoint (`GET /media/:id`) is polled for a few seconds until one exists.
 * The caller still has to check `mediaUrl(media)` — processing can fail or take longer.
 */
export async function uploadAdImage(file: File, purpose: MediaPurpose, signal?: AbortSignal) {
  const uploaded = await uploadAdminMedia(file, purpose, signal);
  return pollUntil(
    uploaded,
    (media) => api.get(`/media/${media.id}`, { schema: mediaSchema, signal }),
    (media) => mediaUrl(media) !== null,
    { tries: 12, delayMs: 750 },
  );
}

export function useAgencySearch(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: qk('agencies', 'picker', term),
    queryFn: ({ signal }) =>
      api.get('/agencies', {
        query: { q: term || undefined, page: 1, pageSize: 8 },
        schema: agencyOptionPageSchema,
        signal,
      }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useComplexSearch(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: qk('complexes', 'picker', term),
    queryFn: ({ signal }) =>
      api.get('/complexes', {
        query: { q: term || undefined, page: 1, pageSize: 20 },
        schema: complexOptionPageSchema,
        signal,
      }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useRegions(enabled = true) {
  return useQuery({
    queryKey: qk('regions', 'list'),
    queryFn: ({ signal }) => api.get('/regions', { schema: regionListSchema, signal }),
    enabled,
    staleTime: 10 * 60_000,
  });
}
