import { MediaPurpose, MediaStatus } from '@house/shared';
import { z } from 'zod';
import { ApiError, api, type QueryParams } from '@/lib/api';
import type {
  AdminCreateForm,
  AreaTypeForm,
  ComplexForm,
  ComplexPhotoItem,
  FaqForm,
  NoticeForm,
  VideoCreateBody,
  VideoPatchBody,
} from './inputs';
import {
  adStatsSchema,
  adminAccountPageSchema,
  adminAccountSchema,
  areaTypeSchema,
  auditLogPageSchema,
  complexDetailSchema,
  complexPageSchema,
  complexPhotoSchema,
  dealRequestStatsSchema,
  faqPageSchema,
  faqSchema,
  listingStatsSchema,
  mediaSchema,
  noticePageSchema,
  noticeSchema,
  siteSettingSchema,
  socialLoginSchema,
  termsPageSchema,
  termsPublishResultSchema,
  termsSchema,
  tradeSyncRunPageSchema,
  tradeSyncTriggerSchema,
  bootstrapAcceptedSchema,
  bootstrapJobSchema,
  bootstrapLatestSchema,
  trafficStatsSchema,
  videoPageSchema,
  videoSchema,
} from './schemas';

/**
 * Typed calls of the m-content screens. Paths follow the admin / complexes module READMEs; the ones
 * marked ASSUMED are not listed there yet (see docs/frontend-integration/m-content.md).
 */
type Opts = { signal?: AbortSignal };
/** Polls of GET /admin/media/:id while an upload is still PENDING (~10 s). */
const PHOTO_READY_TRIES = 14;
/**
 * Path segment from a route param / query value. Next hands route params over decoded, so an id
 * like `..%2Fadmins` would otherwise walk the request onto another endpoint.
 */
const seg = (value: string) => encodeURIComponent(value);

// ---------- 공지사항 ----------
export const notices = {
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/notices', { query, schema: noticePageSchema, ...o }),
  get: (id: string, o?: Opts) =>
    api.get(`/admin/notices/${seg(id)}`, { schema: noticeSchema, ...o }),
  create: (body: NoticeForm) => api.post('/admin/notices', body, { schema: noticeSchema }),
  update: (id: string, body: Partial<NoticeForm>) =>
    api.patch(`/admin/notices/${seg(id)}`, body, { schema: noticeSchema }),
  remove: (id: string) => api.delete(`/admin/notices/${seg(id)}`),
};

// ---------- FAQ ----------
export const faqs = {
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/faqs', { query: { pageSize: 100, ...query }, schema: faqPageSchema, ...o }),
  create: (body: FaqForm) => api.post('/admin/faqs', body, { schema: faqSchema }),
  update: (id: string, body: Partial<FaqForm>) =>
    api.patch(`/admin/faqs/${seg(id)}`, body, { schema: faqSchema }),
  remove: (id: string) => api.delete(`/admin/faqs/${seg(id)}`),
  /** ASSUMED */
  reorder: (ids: string[]) => api.put('/admin/faqs/order', { ids }),
};

// ---------- 동네TV ----------
export const videos = {
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/videos', { query: { pageSize: 100, ...query }, schema: videoPageSchema, ...o }),
  /** Body built by `videoCreateBody` (empty optional fields left out, as localVideoInputSchema wants). */
  create: (body: VideoCreateBody) => api.post('/admin/videos', body, { schema: videoSchema }),
  /** Body built by `videoPatchBody`: changed fields only, `null` clears a link (ASSUMED nullable). */
  update: (id: string, body: VideoPatchBody) =>
    api.patch(`/admin/videos/${seg(id)}`, body, { schema: videoSchema }),
  remove: (id: string) => api.delete(`/admin/videos/${seg(id)}`),
  /** ASSUMED */
  reorder: (ids: string[]) => api.put('/admin/videos/order', { ids }),
};

// ---------- 사이트 설정 ----------
export const siteSettings = {
  get: <S extends z.ZodType>(key: string, value: S, query?: QueryParams, o?: Opts) =>
    api.get(`/admin/site-settings/${seg(key)}`, { query, schema: siteSettingSchema(value), ...o }),
  put: <S extends z.ZodType>(key: string, value: S, body: unknown) =>
    api.put(`/admin/site-settings/${seg(key)}`, body, { schema: siteSettingSchema(value) }),
};

// ---------- 약관 ----------
export interface TermsInput {
  type: string;
  version: string;
  title: string;
  content: string;
  isRequired: boolean;
  effectiveAt: string;
}
export const terms = {
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/terms', { query: { pageSize: 100, ...query }, schema: termsPageSchema, ...o }),
  get: (id: string, o?: Opts) => api.get(`/admin/terms/${seg(id)}`, { schema: termsSchema, ...o }),
  create: (body: TermsInput) => api.post('/admin/terms', body, { schema: termsSchema }),
  update: (id: string, body: Partial<Omit<TermsInput, 'type'>>) =>
    api.patch(`/admin/terms/${seg(id)}`, body, { schema: termsSchema }),
  remove: (id: string) => api.delete(`/admin/terms/${seg(id)}`),
  /** ASSUMED path */
  publish: (id: string) =>
    api.post(`/admin/terms/${seg(id)}/publish`, undefined, { schema: termsPublishResultSchema }),
};

// ---------- 단지 ----------
export const complexes = {
  /** ASSUMED */
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/complexes', { query, schema: complexPageSchema, ...o }),
  /** ASSUMED */
  get: (id: string, o?: Opts) =>
    api.get(`/admin/complexes/${seg(id)}`, { schema: complexDetailSchema, ...o }),
  create: (body: ComplexForm) =>
    api.post('/admin/complexes', body, { schema: complexDetailSchema }),
  update: (id: string, body: Partial<ComplexForm>) =>
    api.patch(`/admin/complexes/${seg(id)}`, body, { schema: complexDetailSchema }),
  remove: (id: string) => api.delete(`/admin/complexes/${seg(id)}`),
  addAreaType: (id: string, body: AreaTypeForm) =>
    api.post(`/admin/complexes/${seg(id)}/area-types`, body, { schema: areaTypeSchema }),
  updateAreaType: (id: string, areaTypeId: string, body: AreaTypeForm) =>
    api.patch(`/admin/complexes/${seg(id)}/area-types/${seg(areaTypeId)}`, body, {
      schema: areaTypeSchema,
    }),
  removeAreaType: (id: string, areaTypeId: string) =>
    api.delete(`/admin/complexes/${seg(id)}/area-types/${seg(areaTypeId)}`),
  /**
   * POST /admin/media?purpose=COMPLEX_PHOTO, then waits (GET /admin/media/:id) until the image is
   * READY — the photo list only accepts usable media. Throws when processing failed or takes
   * longer than ~10 s.
   */
  uploadPhoto: async (
    file: File,
    sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  ) => {
    const form = new FormData();
    form.append('file', file);
    let media = await api.post('/admin/media', form, {
      query: { purpose: MediaPurpose.COMPLEX_PHOTO },
      schema: mediaSchema,
      timeoutMs: 60_000,
    });
    for (let i = 0; i < PHOTO_READY_TRIES && media.status === MediaStatus.PENDING; i += 1) {
      await sleep(750);
      media = await api.get(`/admin/media/${seg(media.id)}`, { schema: mediaSchema });
    }
    if (media.status === MediaStatus.FAILED)
      throw new ApiError(422, {
        code: 'MEDIA_PROCESSING_FAILED',
        message: '이미지를 처리하지 못했어요. 다른 파일로 다시 올려 주세요.',
      });
    if (media.status === MediaStatus.PENDING)
      throw new ApiError(504, {
        code: 'MEDIA_PENDING',
        message: '이미지 처리가 오래 걸리고 있어요. 잠시 후 다시 올려 주세요.',
      });
    return media;
  },
  /**
   * PUT /admin/complexes/:id/photos { items } — replaces the whole photo list (order = display
   * order, first = 대표 사진; left-out photos are removed) → the new list.
   */
  setPhotos: (id: string, items: ComplexPhotoItem[]) =>
    api.put(
      `/admin/complexes/${seg(id)}/photos`,
      { items: items.map((p) => ({ mediaId: p.mediaId, caption: p.caption ?? null })) },
      { schema: z.array(complexPhotoSchema) },
    ),
  syncRuns: (query: QueryParams, o?: Opts) =>
    api.get('/admin/complexes/trade-sync/runs', { query, schema: tradeSyncRunPageSchema, ...o }),
  triggerSync: (yearMonth: number) =>
    api.post('/admin/complexes/trade-sync', { yearMonth }, { schema: tradeSyncTriggerSchema }),
  /** POST /admin/complexes/bootstrap { months, dryRun } → 202 { jobId } (실거래가로 단지 만들기). */
  startBootstrap: (body: { months: number; dryRun: boolean }) =>
    api.post('/admin/complexes/bootstrap', body, { schema: bootstrapAcceptedSchema }),
  /** GET /admin/complexes/bootstrap/:jobId — progress, preview, result. */
  bootstrapJob: (jobId: string, o?: Opts) =>
    api.get(`/admin/complexes/bootstrap/${seg(jobId)}`, { schema: bootstrapJobSchema, ...o }),
  /** GET /admin/complexes/bootstrap → the latest run ({ item: null } before the first one). */
  latestBootstrap: (o?: Opts) =>
    api.get('/admin/complexes/bootstrap', { schema: bootstrapLatestSchema, ...o }),
};

// ---------- 관리자 계정 ----------
export const admins = {
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/admins', {
      query: { pageSize: 50, ...query },
      schema: adminAccountPageSchema,
      ...o,
    }),
  create: (body: AdminCreateForm) =>
    api.post('/admin/admins', body, { schema: adminAccountSchema }),
  update: (
    id: string,
    body: { name?: string; role?: string; status?: string; ipAllowlist?: string[] },
  ) => api.patch(`/admin/admins/${seg(id)}`, body, { schema: adminAccountSchema }),
  /**
   * DELETE /admin/admins/:id → 204: a soft delete — the row stays (DISABLED, e-mail released) as the
   * actor of its audit log, so the same e-mail can be used again.
   */
  remove: (id: string) => api.delete(`/admin/admins/${seg(id)}`),
  /** POST /admin/admins/:id/unlock — lifts a second-factor lockout. */
  unlock: (id: string) =>
    api.post(`/admin/admins/${seg(id)}/unlock`, undefined, { schema: adminAccountSchema }),
  resetTotp: (id: string) =>
    api.post(`/admin/admins/${seg(id)}/reset-totp`, undefined, { schema: adminAccountSchema }),
  resetPassword: (id: string, password: string) =>
    api.post(
      `/admin/admins/${seg(id)}/reset-password`,
      { password },
      { schema: adminAccountSchema },
    ),
};

// ---------- 작업 기록 · 간편로그인 · 통계 ----------
export const auditLogs = {
  list: (query: QueryParams, o?: Opts) =>
    api.get('/admin/audit-logs', { query, schema: auditLogPageSchema, ...o }),
};

/** ASSUMED */
export const socialLogin = {
  status: (query?: QueryParams, o?: Opts) =>
    api.get('/admin/social-login', { query, schema: socialLoginSchema, ...o }),
};

/** ASSUMED */
export const stats = {
  traffic: (query: QueryParams, o?: Opts) =>
    api.get('/admin/stats/traffic', { query, schema: trafficStatsSchema, ...o }),
  listings: (query: QueryParams, o?: Opts) =>
    api.get('/admin/stats/listings', { query, schema: listingStatsSchema, ...o }),
  dealRequests: (query: QueryParams, o?: Opts) =>
    api.get('/admin/stats/deal-requests', { query, schema: dealRequestStatsSchema, ...o }),
  ads: (query: QueryParams, o?: Opts) =>
    api.get('/admin/stats/ads', { query, schema: adStatsSchema, ...o }),
};
