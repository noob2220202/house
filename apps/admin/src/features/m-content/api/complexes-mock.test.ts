// @vitest-environment node
import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  complexDetailSchema,
  complexPageSchema,
  complexPhotoSchema,
  type ComplexDetail,
} from './schemas';

/**
 * The 단지 mocks follow the complexes module: the list is `AdminComplexListItem` (name order,
 * `missingExternalCode`), photos are `ComplexPhotoView` and only change through the whole-list
 * PUT /admin/complexes/:id/photos.
 */
type R = {
  list: typeof import('@/app/mock-api/v1/admin/complexes/route');
  detail: typeof import('@/app/mock-api/v1/admin/complexes/[id]/route');
  photos: typeof import('@/app/mock-api/v1/admin/complexes/[id]/photos/route');
};
let r: R;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  r = {
    list: await import('@/app/mock-api/v1/admin/complexes/route'),
    detail: await import('@/app/mock-api/v1/admin/complexes/[id]/route'),
    photos: await import('@/app/mock-api/v1/admin/complexes/[id]/photos/route'),
  };
});

const req = (path: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost:3201/api/v1${path}${path.includes('?') ? '&' : '?'}_delay=1`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      cookie: `${COOKIE_NAMES.ADMIN_SESSION}=mock-ADMIN; ${COOKIE_NAMES.CSRF}=t`,
      'x-csrf-token': 't',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

describe('complex mocks (real contract)', () => {
  it('lists AdminComplexListItem rows by name and filters missing 국토부 codes', async () => {
    const page = complexPageSchema.parse(
      await (await r.list.GET(req('/admin/complexes?pageSize=100'))).json(),
    );
    const names = page.items.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ko')));
    expect(page.items[0]).toMatchObject({ photoCount: null, areaTypeCount: null });
    const missing = complexPageSchema.parse(
      await (
        await r.list.GET(req('/admin/complexes?missingExternalCode=true&pageSize=100'))
      ).json(),
    );
    expect(missing.items.every((c) => c.externalCode === null)).toBe(true);
  });

  it('replaces the whole photo list with PUT …/photos', async () => {
    const page = complexPageSchema.parse(
      await (await r.list.GET(req('/admin/complexes?pageSize=100'))).json(),
    );
    let target: ComplexDetail | null = null;
    for (const c of page.items) {
      const d = complexDetailSchema.parse(
        await (
          await r.detail.GET(req(`/admin/complexes/${c.id}`), {
            params: Promise.resolve({ id: c.id }),
          })
        ).json(),
      );
      if (d.photos.length >= 2) {
        target = d;
        break;
      }
    }
    if (!target) throw new Error('expected a complex with two photos');
    const [first, second] = target.photos;
    const params = Promise.resolve({ id: target.id });
    const res = await r.photos.PUT(
      req(`/admin/complexes/${target.id}/photos`, {
        method: 'PUT',
        body: {
          items: [{ mediaId: second!.mediaId, caption: '대표로' }, { mediaId: first!.mediaId }],
        },
      }),
      { params },
    );
    expect(res.status).toBe(200);
    const saved = z.array(complexPhotoSchema).parse(await res.json());
    expect(saved.map((p) => [p.mediaId, p.sortOrder, p.caption])).toEqual([
      [second!.mediaId, 0, '대표로'],
      [first!.mediaId, 1, null],
    ]);
    expect(saved[0]!.id).toBe(second!.mediaId);
    const dup = await r.photos.PUT(
      req(`/admin/complexes/${target.id}/photos`, {
        method: 'PUT',
        body: { items: [{ mediaId: first!.mediaId }, { mediaId: first!.mediaId }] },
      }),
      { params },
    );
    expect(dup.status).toBe(400);
  });
});
