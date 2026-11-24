import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ListingPhoto } from '../api/schemas';
import { shortCaption } from './Gallery';
import { Lightbox, stepIndex } from './Lightbox';
import { formatDistance, placePois } from './LocationSection';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('./ListingInteractions', () => ({ useListingInteractions: () => ({}) }));
vi.mock('@/components/map', () => ({ MapView: () => null, MapZoomControl: () => null }));

const photos: ListingPhoto[] = ['단지 전경', '거실', '주방'].map((caption, i) => ({
  id: `p${i}`,
  url: `/media/p${i}.jpg`,
  caption,
  isCover: i === 0,
}));

function Harness({ onClose }: { onClose: (i: number) => void }) {
  const [index, setIndex] = useState(0);
  return (
    <Lightbox
      photos={photos}
      title="테스트 매물"
      index={index}
      onIndexChange={setIndex}
      onClose={onClose}
    />
  );
}

describe('stepIndex', () => {
  it('wraps around both ends', () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(1, 1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});

describe('Lightbox', () => {
  it('is a labelled modal dialog showing the current photo', () => {
    render(<Harness onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: '테스트 매물 사진 크게 보기' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByAltText('테스트 매물 단지 전경')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 1. 단지 전경' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('navigates with the arrow keys, Home / End and the buttons', () => {
    render(<Harness onClose={() => undefined} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByAltText('테스트 매물 거실')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByAltText('테스트 매물 주방')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Home' });
    expect(screen.getByAltText('테스트 매물 단지 전경')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'End' });
    expect(screen.getByAltText('테스트 매물 주방')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 사진' }));
    expect(screen.getByAltText('테스트 매물 단지 전경')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '사진 2. 거실' }));
    expect(screen.getByAltText('테스트 매물 거실')).toBeInTheDocument();
  });

  it('closes on Escape and the close button, reporting the visible index', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: '사진 보기 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('changes photo on a horizontal swipe only', () => {
    render(<Harness onClose={() => undefined} />);
    const stage = screen.getByAltText('테스트 매물 단지 전경').parentElement as HTMLElement;
    fireEvent.pointerDown(stage, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(stage, { clientX: 200, clientY: 210 });
    expect(screen.getByAltText('테스트 매물 거실')).toBeInTheDocument();
    // mostly vertical movement → ignored
    fireEvent.pointerDown(stage, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(stage, { clientX: 240, clientY: 400 });
    expect(screen.getByAltText('테스트 매물 거실')).toBeInTheDocument();
    fireEvent.pointerDown(stage, { clientX: 100, clientY: 200 });
    fireEvent.pointerUp(stage, { clientX: 220, clientY: 200 });
    expect(screen.getByAltText('테스트 매물 단지 전경')).toBeInTheDocument();
  });
});

describe('gallery / location helpers', () => {
  it('shortens thumbnail captions', () => {
    expect(shortCaption('단지 전경 · 신대 호수공원에서', 0)).toBe('전경');
    expect(shortCaption('평면도 34A', 3)).toBe('평면도');
    expect(shortCaption('거실 · 남향', 1)).toBe('거실');
    expect(shortCaption(null, 4)).toBe('사진 5');
  });

  it('formats distances', () => {
    expect(formatDistance(350)).toBe('350m');
    expect(formatDistance(6800)).toBe('6.8km');
    expect(formatDistance(9449)).toBe('9.4km');
  });

  it('keeps only nearby places that fit the mini map without covering the pin', () => {
    const center = { lat: 34.9215, lng: 127.58 };
    const size = { width: 800, height: 420 };
    const places = [
      {
        category: 'SCHOOL' as const,
        name: '바로 옆',
        distanceM: 10,
        lat: 34.92151,
        lng: 127.58001,
      },
      { category: 'PARK' as const, name: '서쪽 공원', distanceM: 300, lat: 34.9215, lng: 127.5755 },
      { category: 'TRANSIT' as const, name: '먼 역', distanceM: 9000, lat: 34.9457, lng: 127.5035 },
      { category: 'MART' as const, name: '좌표 없음', distanceM: 500 },
    ];
    const naver = placePois(places, center, 16, size, 'naver');
    expect(naver.map((p) => p.place.name)).toEqual(['서쪽 공원']);
    expect(naver[0]?.x).toBeLessThan(size.width / 2);
    expect(Math.round(naver[0]?.y ?? 0)).toBe(size.height / 2);
    expect(placePois(places, center, 16, size, 'static').map((p) => p.place.name)).toEqual([
      '서쪽 공원',
    ]);
    expect(placePois(places, center, 16, { width: 0, height: 0 }, 'naver')).toEqual([]);
  });
});
