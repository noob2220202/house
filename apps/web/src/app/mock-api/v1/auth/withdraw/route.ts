import { withdrawSchema } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockUnauthenticated } from '@/lib/mock';
import { spendWithdrawTicket } from '../_state';

// POST /api/v1/auth/withdraw — `{ confirm: true, reason? }`: withdrawal of a suspended member
// without a session, authenticated by the single-use ticket cookie the refused login set
// (mock: `as=suspended` on the OAuth start). 204, or 401 without a live ticket.
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 500);
  const parsed = withdrawSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    );
  const res = new NextResponse(null, { status: 204 });
  return spendWithdrawTicket(req, res) ? res : mockUnauthenticated();
}
