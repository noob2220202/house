// @vitest-environment node
import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { appLinksFormSchema } from './inputs';
import { appLinksValueSchema, homeLayoutSchema, siteSettingSchema } from './schemas';

/**
 * D9: HOME_LAYOUT and APP_LINKS are real site-setting keys. The mock validates every key with the
 * shared `siteSettingSchemas` and answers the shared `SiteSettingView` (`updatedBy`).
 */
type Route = typeof import('@/app/mock-api/v1/admin/site-settings/[key]/route');
let route: Route;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  route = await import('@/app/mock-api/v1/admin/site-settings/[key]/route');
});

const req = (key: string, body?: unknown) =>
  new NextRequest(`http://localhost:3201/api/v1/admin/site-settings/${key}?_delay=1`, {
    method: body === undefined ? 'GET' : 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: `${COOKIE_NAMES.ADMIN_SESSION}=mock-ADMIN; ${COOKIE_NAMES.CSRF}=t`,
      'x-csrf-token': 't',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (key: string) => ({ params: Promise.resolve({ key }) });

describe('site settings mock (real contract)', () => {
  it('stores HOME_LAYOUT and answers a SiteSettingView', async () => {
    const sections = [
      { key: 'HERO_SEARCH', visible: true },
      { key: 'NOTICES', visible: false },
    ];
    const res = await route.PUT(req('HOME_LAYOUT', { sections }), ctx('HOME_LAYOUT'));
    expect(res.status).toBe(200);
    const raw = (await res.json()) as Record<string, unknown>;
    expect(typeof (raw.updatedBy as { name?: unknown } | null)?.name).toBe('string');
    const parsed = siteSettingSchema(homeLayoutSchema).parse(raw);
    expect(parsed.value?.sections).toEqual(sections);
    expect(parsed.updatedByAdminName).toBe((raw.updatedBy as { name: string }).name);
    const dup = await route.PUT(
      req('HOME_LAYOUT', { sections: [...sections, sections[0]] }),
      ctx('HOME_LAYOUT'),
    );
    expect(dup.status).toBe(400);
  });

  it('stores APP_LINKS (https store pages only) and refuses unknown keys', async () => {
    const bad = await route.PUT(
      req('APP_LINKS', { iosUrl: 'http://apps.apple.com/x' }),
      ctx('APP_LINKS'),
    );
    expect(bad.status).toBe(400);
    const ok = await route.PUT(
      req('APP_LINKS', { iosUrl: 'https://apps.apple.com/kr/app/id1' }),
      ctx('APP_LINKS'),
    );
    const parsed = siteSettingSchema(appLinksValueSchema).parse(await ok.json());
    expect(parsed.value).toEqual({ iosUrl: 'https://apps.apple.com/kr/app/id1' });
    expect((await route.GET(req('NOPE'), ctx('NOPE'))).status).toBe(400);
  });

  it('validates the app link form like the shared schema', () => {
    expect(appLinksFormSchema.safeParse({ iosUrl: '', androidUrl: '' }).success).toBe(true);
    expect(
      appLinksFormSchema.safeParse({ iosUrl: 'https://apps.apple.com/kr/app/x', androidUrl: '' })
        .success,
    ).toBe(true);
    expect(
      appLinksFormSchema.safeParse({ iosUrl: 'javascript:alert(1)', androidUrl: '' }).success,
    ).toBe(false);
    expect(
      appLinksFormSchema.safeParse({ iosUrl: 'https://u:p@apps.apple.com/x', androidUrl: '' })
        .success,
    ).toBe(false);
  });
});
