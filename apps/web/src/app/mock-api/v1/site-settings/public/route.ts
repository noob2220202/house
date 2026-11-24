import { mockGuard, mockJson } from '@/lib/mock';
import { PUBLIC_SITE_SETTINGS } from '../_fixtures';

// GET /api/v1/site-settings/public — public, cacheable (admin module).
export function GET() {
  const off = mockGuard();
  if (off) return off;
  return mockJson(PUBLIC_SITE_SETTINGS);
}
