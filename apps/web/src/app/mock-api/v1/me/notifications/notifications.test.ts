import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import { isAgencyNotification } from '@/features/w-me/lib/notifications';
import { notificationPageSchema, notificationReadResultSchema } from '@/features/w-me/schemas';
import { mockSessionValue } from '@/lib/mock';
import { POST as markRead } from './read/route';
import { GET as feed } from './route';
import { GET as unreadCount } from './unread-count/route';

const CSRF = 'csrf-test';
function req(path: string, init: { method?: string; body?: unknown } = {}) {
  const r = new NextRequest(`http://localhost/mock-api/v1${path}`, {
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: { 'content-type': 'application/json', 'x-csrf-token': CSRF },
  });
  r.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue('AGENCY_OWNER'));
  r.cookies.set(COOKIE_NAMES.CSRF, CSRF);
  return r;
}
const unread = async (scope = '') =>
  (
    (await (await unreadCount(req(`/me/notifications/unread-count?_delay=1${scope}`))).json()) as {
      unread: number;
    }
  ).unread;

describe('me/notifications mock — B5 scope + WI-7 counters', () => {
  it('scope=agency returns agency rows only, with the scope unread count', async () => {
    const page = notificationPageSchema.parse(
      await (await feed(req('/me/notifications?_delay=1&limit=100&scope=agency'))).json(),
    );
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every(isAgencyNotification)).toBe(true);
    expect(page.unreadCount).toBe(await unread('&scope=agency'));
    const personal = notificationPageSchema.parse(
      await (await feed(req('/me/notifications?_delay=1&limit=100&scope=personal'))).json(),
    );
    expect(personal.items.some(isAgencyNotification)).toBe(false);
  });

  it('“read all” of a scope answers { updated, unread } and leaves the other audience alone', async () => {
    const personalBefore = await unread('&scope=personal');
    const agencyBefore = await unread('&scope=agency');
    expect(agencyBefore).toBeGreaterThan(0);
    const res = await markRead(
      req('/me/notifications/read?_delay=1&scope=agency', { method: 'POST', body: { all: true } }),
    );
    const result = notificationReadResultSchema.parse(await res.json());
    expect(result).toEqual({ updated: agencyBefore, unread: 0 });
    expect(await unread('&scope=agency')).toBe(0);
    expect(await unread('&scope=personal')).toBe(personalBefore);
    expect(await unread()).toBe(personalBefore);
  });

  it('refuses a body with both ids and all (notificationReadSchema)', async () => {
    const res = await markRead(
      req('/me/notifications/read?_delay=1', { method: 'POST', body: { all: true, ids: ['x'] } }),
    );
    expect(res.status).toBe(400);
  });
});
