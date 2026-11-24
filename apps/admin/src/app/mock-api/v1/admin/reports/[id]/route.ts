import { reportReviewSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  newId,
  nowIso,
  readBody,
  validationError,
} from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { reportsDb, toReportDetail } from '../_fixtures';

const notFound = () => mockNotFound('REPORT_NOT_FOUND', '신고를 찾을 수 없습니다.');

// GET /api/v1/admin/reports/:id — report + live target snapshot, reporter stats, related reports.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const report = reportsDb().find((r) => r.id === id);
  return report ? mockJson(toReportDetail(report)) : notFound();
}

// PATCH /api/v1/admin/reports/:id — `reportReviewSchema` `{ status?: 'IN_REVIEW', note? }`:
// 검토 시작 and/or the moderators' note (resolutionNote) of an OPEN report; 409 once handled.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const report = reportsDb().find((r) => r.id === id);
  if (!report) return notFound();
  const parsed = reportReviewSchema.safeParse(await readBody(req));
  if (!parsed.success) return validationError('note', '변경할 내용을 입력해 주세요.');
  if (report.status !== 'RECEIVED' && report.status !== 'IN_REVIEW')
    return mockError(409, 'REPORT_ALREADY_HANDLED', '이미 처리된 신고입니다.');
  const { status, note } = parsed.data;
  if (status) report.status = status;
  if (note !== undefined) {
    report.resolutionNote = note || null;
    report.internalNote = note || null;
  }
  report.handledByName = MOCK_ADMIN_NAME[gate.role];
  report.timeline.unshift({
    id: newId('e4'),
    status: status ?? null,
    note: note === undefined ? null : note || '메모를 지웠습니다.',
    adminName: MOCK_ADMIN_NAME[gate.role],
    createdAt: nowIso(),
  });
  return mockJson(toReportDetail(report));
}
