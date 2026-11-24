import { describe, expect, it } from 'vitest';
import { BRAND } from '@/config/brand';
import { DEFAULT_OG_IMAGE, absoluteUrl, buildMetadata } from './metadata';

describe('buildMetadata', () => {
  it('builds absolute titles (no double brand suffix), canonical and OG', () => {
    const home = buildMetadata({ path: '/' });
    expect(home.title).toEqual({ absolute: `${BRAND.name} | ${BRAND.tagline}` });
    const page = buildMetadata({
      title: '아파트·분양권 지도',
      path: '/map/apt',
      image: '/media/og.jpg',
    });
    expect(page.title).toEqual({ absolute: `아파트·분양권 지도 | ${BRAND.name}` });
    expect(page.alternates?.canonical).toBe(absoluteUrl('/map/apt'));
    expect(page.openGraph?.images).toEqual([{ url: absoluteUrl('/media/og.jpg') }]);
    expect(page.robots).toBeUndefined();
  });
  it('falls back to the branded default image, always as a large card', () => {
    const home = buildMetadata({ path: '/' });
    expect(home.openGraph?.images).toEqual([{ url: absoluteUrl(DEFAULT_OG_IMAGE) }]);
    expect(home.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    });
    const page = buildMetadata({ title: 'x', path: '/x', image: '/media/og.jpg' });
    expect(page.twitter).toMatchObject({ card: 'summary_large_image' });
  });
  it('supports noindex pages', () => {
    expect(buildMetadata({ title: '내 정보', path: '/me', noindex: true }).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});
