// @vitest-environment node
import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  bootstrapAcceptedSchema,
  bootstrapJobSchema,
  bootstrapLatestSchema,
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
  bootstrap: typeof import('@/app/mock-api/v1/admin/complexes/bootstrap/route');
  bootstrapJob: typeof import('@/app/mock-api/v1/admin/complexes/bootstrap/[jobId]/route');
  list: typeof import('@/app/mock-api/v1/admin/complexes/route');
  detail: typeof import('@/app/mock-api/v1/admin/complexes/[id]/route');
  photos: typeof import('@/app/mock-api/v1/admin/complexes/[id]/photos/route');
};
let r: R;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  r = {
    bootstrap: await import('@/app/mock-api/v1/admin/complexes/bootstrap/route'),
    bootstrapJob: await import('@/app/mock-api/v1/admin/complexes/bootstrap/[jobId]/route'),
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

  it('runs 실거래가로 단지 만들기: preview, then a real run adds TRADE_BOOTSTRAP 단지 once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const listAuto = async () =>
        complexPageSchema.parse(
          await (
            await r.list.GET(req('/admin/complexes?source=TRADE_BOOTSTRAP&pageSize=100'))
          ).json(),
        );
      expect((await listAuto()).total).toBe(0);
      const latest0 = bootstrapLatestSchema.parse(
        await (await r.bootstrap.GET(req('/admin/complexes/bootstrap'))).json(),
      );
      expect(latest0.item).toBeNull();

      const run = async (dryRun: boolean) => {
        const res = await r.bootstrap.POST(
          req('/admin/complexes/bootstrap', { method: 'POST', body: { months: 60, dryRun } }),
        );
        expect(res.status).toBe(202);
        const accepted = bootstrapAcceptedSchema.parse(await res.json());
        const get = async () =>
          bootstrapJobSchema.parse(
            await (
              await r.bootstrapJob.GET(req(`/admin/complexes/bootstrap/${accepted.jobId}`), {
                params: Promise.resolve({ jobId: accepted.jobId }),
              })
            ).json(),
          );
        return { accepted, get };
      };

      const preview = await run(true);
      // one run at a time
      const busy = await r.bootstrap.POST(
        req('/admin/complexes/bootstrap', { method: 'POST', body: { months: 60 } }),
      );
      expect(busy.status).toBe(409);
      expect((await preview.get()).status).toMatch(/waiting|active/);
      vi.setSystemTime(Date.now() + 10_000);
      const done = await preview.get();
      expect(done).toMatchObject({ status: 'completed', dryRun: true, result: null });
      expect(done.preview?.toCreate).toBeGreaterThan(0);
      expect(done.preview?.needsLocation).toBeGreaterThan(0);
      expect((await listAuto()).total).toBe(0);

      vi.setSystemTime(Date.now() + 1000);
      const real = await run(false);
      vi.setSystemTime(Date.now() + 10_000);
      const applied = await real.get();
      expect(applied.result?.created).toBe(done.preview?.toCreate);
      expect((await listAuto()).total).toBe(done.preview?.toCreate);
      expect((await listAuto()).items.every((c) => c.source === 'TRADE_BOOTSTRAP')).toBe(true);

      vi.setSystemTime(Date.now() + 1000);
      const again = await run(false);
      vi.setSystemTime(Date.now() + 10_000);
      expect((await again.get()).result?.created).toBe(0);
      expect((await listAuto()).total).toBe(done.preview?.toCreate);
    } finally {
      vi.useRealTimers();
    }
  });
});
