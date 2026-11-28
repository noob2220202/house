import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import { fetchInboxCounts } from './queries';

afterEach(() => vi.restoreAllMocks());

describe('fetchInboxCounts (/agent/notifications tiles)', () => {
  it('reads 새 요청 from the dashboard and 응답 대기 from the SENT/VIEWED proposal total', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockImplementation((path: string) =>
        Promise.resolve(
          path === '/agencies/mine/dashboard'
            ? { dealRequests: { newCount: 3 }, inquiries: { unreadCount: 4 } }
            : { total: 2 },
        ),
      );
    await expect(fetchInboxCounts()).resolves.toEqual({
      newRequests: 3,
      waitingProposals: 2,
      unreadInquiries: 4,
    });
    expect(get).toHaveBeenCalledWith(
      '/agency/proposals',
      expect.objectContaining({ query: { status: 'SENT,VIEWED', page: 1, pageSize: 1 } }),
    );
  });

  it('a failing call leaves only its own counter empty', async () => {
    vi.spyOn(api, 'get').mockImplementation((path: string) =>
      path === '/agency/proposals'
        ? Promise.reject(new ApiError(500, { code: 'INTERNAL', message: 'x' }))
        : Promise.resolve({ dealRequests: { newCount: 5 } }),
    );
    // A dashboard without the 문의함 block leaves only that counter empty too.
    await expect(fetchInboxCounts()).resolves.toEqual({
      newRequests: 5,
      waitingProposals: null,
      unreadInquiries: null,
    });
  });
});
