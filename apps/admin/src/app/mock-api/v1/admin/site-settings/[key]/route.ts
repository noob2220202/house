import { siteSettingSchemas } from '@house/shared';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { homeLayoutInputSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ key: string }> };

/** Real keys validate with the shared schemas; HOME_LAYOUT is an ASSUMED extra key. */
const SCHEMAS: Record<string, z.ZodType> = {
  ...siteSettingSchemas,
  HOME_LAYOUT: homeLayoutInputSchema,
};
const LABELS: Record<string, string> = {
  BUSINESS_INFO: '사업자 정보',
  CONTACT: '고객센터',
  SEO: '검색엔진 노출',
  FEATURES: '기능 설정',
  HOME_LAYOUT: '메인 화면 구성',
};
const missing = () => mockNotFound('NOT_FOUND', '알 수 없는 설정 항목입니다.');

// GET /api/v1/admin/site-settings/:key → { key, value, updatedAt, updatedByAdminName }
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN' });
  if (isResponse(ctx)) return ctx;
  const { key } = await params;
  if (!(key in SCHEMAS)) return missing();
  const row = db().settings[key];
  if (ctx.sp.get('_empty') === '1' || !row)
    return mockJson({ key, value: null, updatedAt: null, updatedByAdminName: null });
  return mockJson({ key, ...row });
}

// PUT /api/v1/admin/site-settings/:key — body = the value object (siteSettingSchemas[key])
export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { key } = await params;
  const schema = SCHEMAS[key];
  if (!schema) return missing();
  const value = await mockBody(req, schema);
  if (isResponse(value)) return value;
  const store = db();
  const before = store.settings[key]?.value ?? null;
  const row = { value, updatedAt: nowIso(), updatedByAdminName: ctx.actor.name };
  store.settings[key] = row;
  audit(ctx, req, {
    action: 'site_setting.update',
    resourceType: 'SiteSetting',
    resourceLabel: `${LABELS[key] ?? key} (${key})`,
    before,
    after: value,
  });
  return mockJson({ key, ...row });
}
