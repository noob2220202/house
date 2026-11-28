// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as server from './server';

/**
 * D-E: every public detail read that can turn into a 404 goes through `serverGetDetail` (outcome
 * cached, "not found" included) instead of the fetch cache, which never replaces a cached 200.
 */
vi.mock('server-only', () => ({}));
vi.mock('./server', () => ({
  serverGet: vi.fn(),
  serverGetOr: vi.fn(),
  serverGetDetail: vi.fn(),
}));
const serverGetDetail = vi.mocked(server.serverGetDetail);
const serverGetOr = vi.mocked(server.serverGetOr);

beforeEach(() => {
  serverGetDetail.mockReset();
  serverGetOr.mockReset();
});

describe('public detail reads', () => {
  it('listing detail: a hidden listing (null) is not found, the 단지 is not asked for', async () => {
    const { getListingDetail } = await import('@/features/w-listing/api/server');
    serverGetDetail.mockResolvedValue(null);
    expect(await getListingDetail('L1')).toBeNull();
    expect(serverGetDetail).toHaveBeenCalledWith(
      '/listings/L1',
      expect.objectContaining({ revalidate: 60, tags: ['listings', 'listing:L1'] }),
    );
    expect(serverGetOr).not.toHaveBeenCalled();
  });

  it('agency profile', async () => {
    const { getAgency } = await import('@/features/w-agencies/api/server');
    serverGetDetail.mockResolvedValue(null);
    expect(await getAgency('b01')).toBeNull();
    expect(serverGetDetail).toHaveBeenCalledWith(
      '/agencies/b01',
      expect.objectContaining({ tags: ['agencies', 'agency:b01'] }),
    );
  });

  it('notice', async () => {
    const { getNotice } = await import('@/features/w-content/api/server');
    serverGetDetail.mockResolvedValue(null);
    expect(await getNotice('n 1')).toBeNull();
    expect(serverGetDetail).toHaveBeenCalledWith(
      '/notices/n%201',
      expect.objectContaining({ tags: ['notices', 'notice:n 1'] }),
    );
  });
});
