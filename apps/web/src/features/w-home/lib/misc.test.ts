import { DealType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  agencyItemSchema,
  agencyStats,
  bannerListSchema,
  homeSummarySchema,
  videoItemSchema,
} from '../api/schemas';
import { bannerClickHref, mapHref, searchHref } from './links';
import { imageProps, isOptimizableImage } from './media';
import { formatDuration, toVideoCard, videoThumbnail } from './video';

describe('links', () => {
  it('builds map links with shareable URL state', () => {
    expect(mapHref('apt')).toBe('/map/apt');
    expect(mapHref('oneroom', { center: { lat: 34.969, lng: 127.483 } })).toBe(
      '/map/oneroom?c=34.969%2C127.483&z=15',
    );
    expect(mapHref('apt', { deal: DealType.SALE })).toBe('/map/apt?deal=SALE');
    expect(mapHref('apt', { deal: 'all', center: null })).toBe('/map/apt');
    expect(mapHref('apt', { center: { lat: 34.93351234, lng: 127.556 }, complexId: 'c1' })).toBe(
      '/map/apt?c=34.93351%2C127.556&z=17&complex=c1',
    );
  });

  it('builds search and banner click links', () => {
    expect(searchHref(' 신대 ')).toBe('/search?q=%EC%8B%A0%EB%8C%80');
    expect(searchHref('신대', DealType.JEONSE)).toBe('/search?q=%EC%8B%A0%EB%8C%80&deal=JEONSE');
    expect(bannerClickHref('b 1')).toMatch(/\/banners\/b%201\/click$/);
  });
});

describe('media', () => {
  it('optimizes only backend media and configured hosts', () => {
    expect(isOptimizableImage('/media/banners/a.jpg')).toBe(true);
    expect(isOptimizableImage('/mock-api/v1/banners/creative/AD-01-pc.svg')).toBe(false);
    expect(isOptimizableImage('/media/banners/a.svg')).toBe(false);
    expect(isOptimizableImage('https://i.ytimg.com/vi/x/hqdefault.jpg')).toBe(false);
    expect(isOptimizableImage('https://cdn.example.kr/a.jpg', ['https://cdn.example.kr'])).toBe(
      true,
    );
    expect(
      isOptimizableImage('https://cdn.example.kr.evil.io/a.jpg', ['https://cdn.example.kr']),
    ).toBe(false);
    expect(imageProps('/media/a.jpg')).toEqual({ src: '/media/a.jpg', unoptimized: false });
  });
});

describe('video', () => {
  it('formats durations', () => {
    expect(formatDuration(872)).toBe('14:32');
    expect(formatDuration(308)).toBe('5:08');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-3)).toBe('0:00');
  });

  it('maps a video to a card and falls back to the YouTube still', () => {
    const now = new Date('2026-11-23T12:00:00+09:00');
    const v = videoItemSchema.parse({
      id: 'v1',
      title: '신대지구 34평',
      youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      publishedAt: '2026-11-20T18:00:00+09:00',
      durationSeconds: 872,
      viewCount: 12000,
    });
    expect(videoThumbnail(v)).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
    expect(toVideoCard(v, now)).toMatchObject({
      href: '/videos?v=v1',
      duration: '14:32',
      caption: '조회수 1.2만회 · 3일 전',
    });
    const bare = videoItemSchema.parse({ id: 'v2', title: '제목만' });
    expect(videoThumbnail(bare)).toBeNull();
    expect(toVideoCard(bare, now)).toMatchObject({ duration: undefined, caption: '' });
  });
});

describe('schemas', () => {
  it('accepts a bare array or an { items } envelope for serve endpoints', () => {
    const banner = { id: 'b1', title: '배너', imageUrl: '/media/b1.jpg' };
    expect(bannerListSchema.parse([banner]).items).toHaveLength(1);
    const parsed = bannerListSchema.parse({
      items: [banner],
      updatedAt: '2026-11-23T06:00:00+09:00',
    });
    expect(parsed.items[0]).toMatchObject({ newWindow: false, imageUrl: '/media/b1.jpg' });
    expect(parsed.updatedAt).toBe('2026-11-23T06:00:00+09:00');
    expect(bannerListSchema.safeParse({ items: [{ id: 'x' }] }).success).toBe(false);
  });

  it('fills defaults for a sparse home summary', () => {
    expect(homeSummarySchema.parse({})).toMatchObject({ assetTypeCounts: {}, regions: [] });
  });

  it('reads agency stats nested (agency detail naming) or flat, and tolerates none', () => {
    const base = { id: 'a1', name: '신대중앙 공인중개사사무소' };
    const nested = agencyItemSchema.parse({
      ...base,
      stats: { deals30d: 14, avgResponseMinutes: 12 },
      recentDealCount: 99,
    });
    expect(agencyStats(nested)).toEqual({ deals30d: 14, avgResponseMinutes: 12 });
    const flat = agencyItemSchema.parse({ ...base, recentDealCount: 9, avgResponseMinutes: 8 });
    expect(agencyStats(flat)).toEqual({ deals30d: 9, avgResponseMinutes: 8 });
    const bare = agencyItemSchema.parse({ ...base, stats: null });
    expect(agencyStats(bare)).toEqual({ deals30d: null, avgResponseMinutes: null });
    expect(bare).toMatchObject({ activeListingCount: 0, specialties: [] });
  });
});
