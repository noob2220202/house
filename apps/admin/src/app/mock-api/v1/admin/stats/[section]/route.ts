import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import {
  adStats,
  dealRequestStats,
  listingStats,
  trafficStats,
} from '@/features/m-content/mock/stats';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';

const SECTIONS = {
  traffic: trafficStats,
  listings: listingStats,
  'deal-requests': dealRequestStats,
  ads: adStats,
} as const;
const ALLOWED_DAYS = [7, 30, 90];

// GET /api/v1/admin/stats/{traffic|listings|deal-requests|ads}?days=7|30|90 — ASSUMED endpoints
// (daily series, oldest → newest, last point = today in KST, plus totals of the previous period).
export async function GET(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const ctx = await mockAdmin(req, { delay: 260 });
  if (isResponse(ctx)) return ctx;
  const { section } = await params;
  const build = SECTIONS[section as keyof typeof SECTIONS];
  if (!build) return mockNotFound();
  const days = Number(ctx.sp.get('days') ?? 30);
  if (!ALLOWED_DAYS.includes(days))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'days', message: '조회 기간은 7, 30, 90일 중에서 고를 수 있습니다.' },
    ]);
  const data = build(days);
  if (ctx.sp.get('_empty') === '1') return mockJson({ ...data, points: [] });
  return mockJson(data);
}
