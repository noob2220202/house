import { describe, expect, it, vi } from 'vitest';
import { pollUntil } from './poll';

const sleep = vi.fn(() => Promise.resolve());
const options = { tries: 5, delayMs: 700, sleep };

describe('pollUntil', () => {
  it('returns the first value without fetching when it is already done', async () => {
    const next = vi.fn();
    expect(await pollUntil({ ready: true }, next, (v) => v.ready, options)).toEqual({
      ready: true,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('re-fetches until the value is done', async () => {
    sleep.mockClear();
    let calls = 0;
    const next = vi.fn(() => Promise.resolve({ ready: ++calls >= 3 }));
    expect(await pollUntil({ ready: false }, next, (v) => v.ready, options)).toEqual({
      ready: true,
    });
    expect(next).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(700);
  });

  it('gives up after the tries and returns the last value', async () => {
    const next = vi.fn(() => Promise.resolve({ ready: false, n: 1 }));
    expect(await pollUntil({ ready: false, n: 0 }, next, (v) => v.ready, options)).toEqual({
      ready: false,
      n: 1,
    });
    expect(next).toHaveBeenCalledTimes(5);
  });

  it('lets fetch errors through', async () => {
    const next = vi.fn(() => Promise.reject(new Error('network')));
    await expect(pollUntil({ ready: false }, next, (v) => v.ready, options)).rejects.toThrow(
      'network',
    );
  });
});
