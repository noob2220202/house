import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  newId,
  nowIso,
  readBody,
  readText,
  validationError,
} from '@/features/m-moderation/mock/handler';
import { mockJson, mockNotFound } from '@/lib/mock';
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

// PATCH /api/v1/admin/reports/:id — body { internalNote } saves the moderators' internal memo
// (status unchanged). Kept apart from resolutionNote, which is forwarded to the reporter / office.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const report = reportsDb().find((r) => r.id === id);
  if (!report) return notFound();
  const note = readText(await readBody(req), 'internalNote');
  if (note.length > 2000)
    return validationError('internalNote', '메모는 2,000자 이내로 입력해 주세요.');
  report.internalNote = note || null;
  report.timeline.unshift({
    id: newId('e4'),
    status: null,
    note: note || '메모를 지웠습니다.',
    adminName: MOCK_ADMIN_NAME[gate.role],
    createdAt: nowIso(),
  });
  return mockJson(toReportDetail(report));
}
