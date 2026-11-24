import type { NextRequest } from 'next/server';
import { registerAgency } from '../_register';

// POST /api/v1/agencies/mine/resubmit (ASSUMED) — corrected application, REJECTED → PENDING.
export function POST(req: NextRequest) {
  return registerAgency(req, 'resubmit');
}
