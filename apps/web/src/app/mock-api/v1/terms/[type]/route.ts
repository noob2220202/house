import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { MOCK_ACTION_CONSENT_TERMS, MOCK_TERMS } from '../_fixtures';
import { termsTypeOf, versionsOf } from './versions/_fixtures';

// GET /api/v1/terms/:type[?version=] — current document of one type (account terms and the D8
// purpose consents; `deal-request-privacy` spelling accepted like the real API) with content, or
// the given published version (consent history: the text a member agreed to). Public.
export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 250);
  if (req.nextUrl.searchParams.get('_fail') === '1')
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  const { type } = await ctx.params;
  const wanted = type.toUpperCase().replace(/-/g, '_');
  const version = req.nextUrl.searchParams.get('version');
  const account = termsTypeOf(wanted);
  const doc = version
    ? [...(account ? versionsOf(account) : []), ...MOCK_ACTION_CONSENT_TERMS].find(
        (d) => d.type === wanted && d.version === version,
      )
    : [...MOCK_TERMS, ...MOCK_ACTION_CONSENT_TERMS].find((d) => d.type === wanted);
  return doc ? mockJson(doc) : mockNotFound('AUTH_TERMS_NOT_FOUND', '약관을 찾을 수 없습니다.');
}
