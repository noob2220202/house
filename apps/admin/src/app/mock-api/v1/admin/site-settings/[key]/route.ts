import { SITE_SETTING_KEY_LABEL, siteSettingSchemas, type SiteSettingKey } from '@house/shared';
import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockError, mockJson } from '@/lib/mock';

type Ctx = { params: Promise<{ key: string }> };

const isKey = (key: string): key is SiteSettingKey => key in siteSettingSchemas;
// Like the API (`siteSettingKeyParamSchema`): an unknown key is a validation error.
const invalidKey = () =>
  mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
    { path: 'key', message: '알 수 없는 설정 항목입니다.' },
  ]);

/** Shared `SiteSettingView` of a stored row. */
function view(key: SiteSettingKey) {
  const row = db().settings[key];
  return row
    ? {
        key,
        value: row.value,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedByAdminName
          ? { id: `admin-${row.updatedByAdminName}`, name: row.updatedByAdminName }
          : null,
      }
    : { key, value: null, updatedAt: null, updatedBy: null };
}

// GET /api/v1/admin/site-settings/:key → SiteSettingView { key, value, updatedAt, updatedBy }
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN' });
  if (isResponse(ctx)) return ctx;
  const { key } = await params;
  if (!isKey(key)) return invalidKey();
  if (ctx.sp.get('_empty') === '1')
    return mockJson({ ...view(key), value: null, updatedAt: null, updatedBy: null });
  return mockJson(view(key));
}

// PUT /api/v1/admin/site-settings/:key — body = the value itself, validated with
// siteSettingSchemas[key] (BUSINESS_INFO · CONTACT · SEO · FEATURES · FOOTER · HOME_LAYOUT ·
// APP_LINKS) → SiteSettingView.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { key } = await params;
  if (!isKey(key)) return invalidKey();
  const value = await mockBody(req, siteSettingSchemas[key]);
  if (isResponse(value)) return value;
  const store = db();
  const before = store.settings[key]?.value ?? null;
  store.settings[key] = { value, updatedAt: nowIso(), updatedByAdminName: ctx.actor.name };
  audit(ctx, req, {
    action: 'site-setting.update',
    resourceType: 'SiteSetting',
    resourceLabel: `${SITE_SETTING_KEY_LABEL[key]} (${key})`,
    before,
    after: value,
  });
  return mockJson(view(key));
}
