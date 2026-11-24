// @vitest-environment node
import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { adminAgencyDetailSchema, adminReportDetailSchema, registryCheckSchema } from './schemas';

/**
 * Moderation mocks follow the real routes: registry check is GET …/registry-check(?refresh=1),
 * documents stream from …/documents/:docId/file, 검토 시작 is PATCH { status: IN_REVIEW } and the
 * resolution takes only RESOLVED / REJECTED.
 */
type R = {
  agency: typeof import('@/app/mock-api/v1/admin/agencies/[id]/route');
  registry: typeof import('@/app/mock-api/v1/admin/agencies/[id]/registry-check/route');
  file: typeof import('@/app/mock-api/v1/admin/agencies/[id]/documents/[docId]/file/route');
  report: typeof import('@/app/mock-api/v1/admin/reports/[id]/route');
  resolve: typeof import('@/app/mock-api/v1/admin/reports/[id]/resolve/route');
  agencies: typeof import('@/app/mock-api/v1/admin/agencies/_fixtures');
  reports: typeof import('@/app/mock-api/v1/admin/reports/_fixtures');
};
let r: R;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  r = {
    agency: await import('@/app/mock-api/v1/admin/agencies/[id]/route'),
    registry: await import('@/app/mock-api/v1/admin/agencies/[id]/registry-check/route'),
    file: await import('@/app/mock-api/v1/admin/agencies/[id]/documents/[docId]/file/route'),
    report: await import('@/app/mock-api/v1/admin/reports/[id]/route'),
    resolve: await import('@/app/mock-api/v1/admin/reports/[id]/resolve/route'),
    agencies: await import('@/app/mock-api/v1/admin/agencies/_fixtures'),
    reports: await import('@/app/mock-api/v1/admin/reports/_fixtures'),
  };
});

function req(path: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  return new NextRequest(`http://localhost:3201/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      cookie: `${COOKIE_NAMES.ADMIN_SESSION}=mock-ADMIN; ${COOKIE_NAMES.CSRF}=t`,
      'x-csrf-token': 't',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe('moderation mocks (real contract)', () => {
  it('serves the agency detail, registry check and document file at the real paths', async () => {
    const row = r.agencies.agenciesDb().find((a) => a.documents.length > 0)!;
    const params = Promise.resolve({ id: row.id });
    const detail = adminAgencyDetailSchema.parse(
      await (await r.agency.GET(req(`/admin/agencies/${row.id}`), { params })).json(),
    );
    expect(detail.documents.length).toBe(row.documents.length);

    const check = await r.registry.GET(
      req(`/admin/agencies/${row.id}/registry-check?refresh=1&_delay=1`),
      { params },
    );
    const raw = (await check.json()) as { status: string; record: unknown };
    expect(['MATCH', 'MISMATCH', 'NOT_FOUND', 'UNAVAILABLE']).toContain(raw.status);
    expect(raw).toHaveProperty('record');
    expect(registryCheckSchema.safeParse(raw).success).toBe(true);

    const doc = row.documents[0]!;
    const file = await r.file.GET(req(`/admin/agencies/${row.id}/documents/${doc.id}/file`), {
      params: Promise.resolve({ id: row.id, docId: doc.id }),
    });
    expect(file.status).toBe(200);
    expect(file.headers.get('cache-control')).toBe('private, no-store');
  });

  it('starts a review with PATCH { status: IN_REVIEW }, saves the note, refuses IN_REVIEW as a resolution', async () => {
    const row = r.reports.reportsDb().find((x) => x.status === 'RECEIVED')!;
    const params = Promise.resolve({ id: row.id });
    const asResolution = await r.resolve.POST(
      req(`/admin/reports/${row.id}/resolve`, { method: 'POST', body: { status: 'IN_REVIEW' } }),
      { params },
    );
    expect(asResolution.status).toBe(400);

    const started = await r.report.PATCH(
      req(`/admin/reports/${row.id}`, { method: 'PATCH', body: { status: 'IN_REVIEW' } }),
      { params },
    );
    expect(adminReportDetailSchema.parse(await started.json()).status).toBe('IN_REVIEW');

    const noted = await r.report.PATCH(
      req(`/admin/reports/${row.id}`, { method: 'PATCH', body: { note: '중개사무소와 통화함' } }),
      { params },
    );
    const parsed = adminReportDetailSchema.parse(await noted.json());
    expect(parsed).toMatchObject({
      resolutionNote: '중개사무소와 통화함',
      internalNote: '중개사무소와 통화함',
    });
    expect(parsed.handledByName).toBeTruthy();

    const empty = await r.report.PATCH(
      req(`/admin/reports/${row.id}`, { method: 'PATCH', body: { internalNote: 'x' } }),
      { params },
    );
    expect(empty.status).toBe(400);
  });
});
