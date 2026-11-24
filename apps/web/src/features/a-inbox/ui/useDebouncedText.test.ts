import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedText } from './useDebouncedText';

describe('useDebouncedText', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (initial = '') => {
    const commit = vi.fn();
    const view = renderHook(({ value }) => useDebouncedText(value, commit, 350), {
      initialProps: { value: initial },
    });
    const type = (text: string) =>
      act(() => {
        view.result.current[1](text);
      });
    const wait = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    return { commit, type, wait, ...view };
  };

  it('commits the trimmed text once, after the pause', () => {
    const { commit, type, wait, result } = setup();
    type('신');
    wait(200);
    type('신대 ');
    expect(result.current[0]).toBe('신대 ');
    wait(349);
    expect(commit).not.toHaveBeenCalled();
    wait(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('신대');
  });

  it('does not commit when nothing but whitespace changed', () => {
    const { commit, type, wait } = setup('신대');
    type('신대 ');
    wait(400);
    expect(commit).not.toHaveBeenCalled();
  });

  it('keeps what was typed while its own commit comes back as the value', () => {
    const { commit, type, wait, result, rerender } = setup();
    type('신');
    wait(350);
    expect(commit).toHaveBeenLastCalledWith('신');
    // The user keeps typing before the URL (value) catches up.
    type('신대');
    rerender({ value: '신' });
    expect(result.current[0]).toBe('신대');
    wait(350);
    expect(commit).toHaveBeenLastCalledWith('신대');
  });

  it('follows external changes (back button, reset) without committing them again', () => {
    const { commit, type, wait, result, rerender } = setup();
    type('레이크파크');
    wait(350);
    rerender({ value: '레이크파크' });
    commit.mockClear();

    rerender({ value: '' });
    expect(result.current[0]).toBe('');
    wait(400);
    expect(commit).not.toHaveBeenCalled();
  });
});
