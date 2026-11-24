import type { NextRequest } from 'next/server';
import { registerAgency } from './mine/_register';
import { searchAgencies } from './_search';

/*
 * /api/v1/agencies
 * POST (a-agency): register the caller's 중개사무소 → PENDING. Body = agencyRegisterSchema.
 * The public search (GET /agencies?q&emdCode&bbox&specialties&page) belongs to the w-agencies
 * group — add its `export function GET` to this file next to POST.
 */
export function POST(req: NextRequest) {
  return registerAgency(req, 'register');
}

// GET (w-agencies): public broker office search — implementation in ./_search.ts.
export function GET(req: NextRequest) {
  return searchAgencies(req);
}
