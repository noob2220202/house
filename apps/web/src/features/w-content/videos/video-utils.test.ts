import type { Video } from '../api/schemas';
import {
  formatDuration,
  spokenDuration,
  thumbnailOf,
  videoCaption,
  youtubeEmbedUrl,
  youtubeIdOf,
} from './video-utils';

const base: Video = {
  id: 'v1',
  title: '신대지구 34평, 지금 사도 될까?',
  youtubeUrl: 'https://www.youtube.com/watch?v=sc0000000v1',
};

describe('video utils', () => {
  it('resolves the YouTube id from the stored id or the URL', () => {
    expect(youtubeIdOf({ ...base, youtubeVideoId: 'abcdefghijk' })).toBe('abcdefghijk');
    expect(youtubeIdOf(base)).toBe('sc0000000v1');
    expect(
      youtubeIdOf({ youtubeVideoId: 'bad id', youtubeUrl: 'https://youtu.be/sc0000000v2' }),
    ).toBe('sc0000000v2');
    expect(
      youtubeIdOf({ youtubeVideoId: null, youtubeUrl: 'https://example.kr/video' }),
    ).toBeNull();
  });

  it('builds a privacy-enhanced embed URL', () => {
    const url = new URL(youtubeEmbedUrl('sc0000000v1'));
    expect(url.origin).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/sc0000000v1');
    expect(url.searchParams.get('autoplay')).toBe('1');
    expect(new URL(youtubeEmbedUrl('sc0000000v1', false)).searchParams.has('autoplay')).toBe(false);
  });

  it('picks a safe thumbnail', () => {
    expect(thumbnailOf({ ...base, thumbnailUrl: '/media/v1.jpg' })).toBe('/media/v1.jpg');
    expect(thumbnailOf({ ...base, thumbnailUrl: 'javascript:alert(1)' })).toBe(
      'https://i.ytimg.com/vi/sc0000000v1/hqdefault.jpg',
    );
    expect(thumbnailOf({ ...base, youtubeUrl: 'https://example.kr/x' })).toBeNull();
  });

  it('formats durations', () => {
    expect(formatDuration(872)).toBe('14:32');
    expect(formatDuration(308)).toBe('5:08');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(45)).toBe('0:45');
    expect(spokenDuration(872)).toBe('14분 32초');
    expect(spokenDuration(3600)).toBe('1시간');
  });

  it('builds the caption from the parts that exist', () => {
    const now = '2026-11-23T12:00:00+09:00';
    expect(
      videoCaption(
        {
          ...base,
          channelName: '순천 동네TV',
          viewCount: 12000,
          publishedAt: '2026-11-20T18:00:00+09:00',
        },
        now,
      ),
    ).toBe('순천 동네TV · 조회수 1.2만회 · 3일 전');
    expect(videoCaption(base, now)).toBe('');
  });
});
