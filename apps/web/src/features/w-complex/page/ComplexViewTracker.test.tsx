import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComplexViewTracker } from './ComplexViewTracker';

const get = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get },
}));

beforeEach(() => get.mockClear());

describe('ComplexViewTracker', () => {
  it('reads the complex once per visit from the browser, uncached (the API counts it)', () => {
    const { rerender } = render(<ComplexViewTracker complexId="c1" />);
    rerender(<ComplexViewTracker complexId="c1" />);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/complexes/c1', { cache: 'no-store' });
  });

  it('counts again when the visitor moves to another complex', () => {
    const { rerender } = render(<ComplexViewTracker complexId="c1" />);
    rerender(<ComplexViewTracker complexId="c2" />);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('swallows failures', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    render(<ComplexViewTracker complexId="c3" />);
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
