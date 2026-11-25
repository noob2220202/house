import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenVisibleAndIdle } from './when-visible-idle';

type Callback = (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void;

describe('whenVisibleAndIdle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits for the element to be visible, then for idle time', () => {
    vi.useFakeTimers();
    let callback: Callback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: Callback) {
          callback = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const run = vi.fn();
    whenVisibleAndIdle(document.createElement('div'), run);
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
    // Hidden (display: none on phones) → never intersecting.
    callback([{ isIntersecting: false }]);
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
    callback([{ isIntersecting: true }]);
    expect(disconnect).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled before it runs', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', undefined);
    const run = vi.fn();
    const cancel = whenVisibleAndIdle(document.createElement('div'), run);
    cancel();
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
  });
});
