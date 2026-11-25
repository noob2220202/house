import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSETS } from '../config/assets';
import { useMapPageState } from './state';

vi.mock('next/navigation', () => ({
  usePathname: () => '/map/apt',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const FALLBACK = { center: { lat: 34.95, lng: 127.49 }, zoom: 13 };
const params = () => new URLSearchParams(window.location.search);

describe('map selection ⇄ URL (아파트 complex mode)', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('picking a price pill while a complex panel is open closes the panel', () => {
    window.history.replaceState(null, '', '/map/apt?complex=c1&sel=c1&c-deal=SALE');
    const { result } = renderHook(() => useMapPageState(ASSETS.apt, FALLBACK));
    act(() => result.current.select('l-solo', { closeComplex: true }));
    expect(params().get('sel')).toBe('l-solo');
    expect(params().has('complex')).toBe(false);
    expect(params().has('c-deal')).toBe(false);
  });

  it('a pill without an open panel never writes `complex`; a complex marker does', () => {
    window.history.replaceState(null, '', '/map/apt');
    const { result } = renderHook(() => useMapPageState(ASSETS.apt, FALLBACK));
    act(() => result.current.select('l-solo', { complex: false, closeComplex: false }));
    expect(params().get('sel')).toBe('l-solo');
    expect(params().has('complex')).toBe(false);
    act(() => result.current.select('c2', { complex: true }));
    expect(params().get('complex')).toBe('c2');
    // Back / forward: every selection is its own history entry, deselect clears both.
    act(() => result.current.select(null));
    expect(params().has('sel')).toBe(false);
    expect(params().has('complex')).toBe(false);
  });
});
