import type { z } from 'zod';
import { api, type QueryParams } from '@/lib/api';
import type {
  AdminCreateForm,
  AreaTypeForm,
  ComplexForm,
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
  trafficStatsSchema,
  videoPageSchema,
  videoSchema,
} from './schemas';

/**
 * Typed calls of the m-content screens. Paths follow the admin / complexes module READMEs; the ones
 * marked ASSUMED are not listed there yet (see docs/frontend-integration/m-content.md).
 */
type Opts = { signal?: AbortSignal };
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
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/admin/media', form, {
      query: { purpose: 'COMPLEX_PHOTO' },
      schema: mediaSchema,
      timeoutMs: 60_000,
    });
  },
  addPhoto: (id: string, body: { mediaId: string; caption?: string | null }) =>
    api.post(`/admin/complexes/${seg(id)}/photos`, body, { schema: complexPhotoSchema }),
  updatePhoto: (id: string, photoId: string, body: { caption: string | null }) =>
    api.patch(`/admin/complexes/${seg(id)}/photos/${seg(photoId)}`, body, {
      schema: complexPhotoSchema,
    }),
  removePhoto: (id: string, photoId: string) =>
    api.delete(`/admin/complexes/${seg(id)}/photos/${seg(photoId)}`),
  reorderPhotos: (id: string, ids: string[]) =>
    api.put(`/admin/complexes/${seg(id)}/photos/order`, { ids }),
  syncRuns: (query: QueryParams, o?: Opts) =>
    api.get('/admin/complexes/trade-sync/runs', { query, schema: tradeSyncRunPageSchema, ...o }),
  triggerSync: (yearMonth: number) =>
    api.post('/admin/complexes/trade-sync', { yearMonth }, { schema: tradeSyncTriggerSchema }),
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
  remove: (id: string) => api.delete(`/admin/admins/${seg(id)}`),
  /** ASSUMED */
  resetTotp: (id: string) =>
    api.post(`/admin/admins/${seg(id)}/reset-totp`, undefined, { schema: adminAccountSchema }),
  /** ASSUMED */
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
