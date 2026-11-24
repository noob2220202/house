import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { listVideos } from './_fixtures';

// GET /api/v1/videos?page&pageSize — public 동네TV list, published only, by sortOrder (admin module).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const items = listVideos().sort((a, b) => a.sortOrder - b.sortOrder);
  return mockJson(mockPaginate(items, req, { pageSize: 12 }));
}
