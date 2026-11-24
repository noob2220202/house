import { isSafeLinkUrl, parseYoutubeVideoId } from '@house/shared';
import { formatCompactCount, formatRelativeTime } from '@/lib/format';
import type { Video } from '../api/schemas';

const YOUTUBE_ID = /^[\w-]{11}$/;

/** The 11-char YouTube id: the stored one when valid, otherwise parsed from the URL. */
export function youtubeIdOf(video: Pick<Video, 'youtubeVideoId' | 'youtubeUrl'>): string | null {
  if (video.youtubeVideoId && YOUTUBE_ID.test(video.youtubeVideoId)) return video.youtubeVideoId;
  return parseYoutubeVideoId(video.youtubeUrl);
}

/** Privacy-enhanced embed URL (no cookies until the visitor presses play). */
export function youtubeEmbedUrl(id: string, autoplay = true): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

/** Thumbnail to show: the API's `thumbnailUrl` when safe, else YouTube's default still. */
export function thumbnailOf(video: Video): string | null {
  if (video.thumbnailUrl && isSafeLinkUrl(video.thumbnailUrl)) return video.thumbnailUrl;
  const id = youtubeIdOf(video);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Shared video-length formatter ("14:32", "1:02:05", "0:45"). */
export { formatDuration } from '@/lib/format/number';

/** "14분 32초" for screen readers. */
export function spokenDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h > 0 ? `${h}시간` : '', m > 0 ? `${m}분` : '', s > 0 || total === 0 ? `${s}초` : '']
    .filter(Boolean)
    .join(' ');
}

/** "순천 동네TV · 조회수 1.2만회 · 3일 전" — parts that are missing are skipped. */
export function videoCaption(video: Video, now: string, withChannel = true): string {
  return [
    withChannel ? video.channelName : null,
    typeof video.viewCount === 'number' ? `조회수 ${formatCompactCount(video.viewCount)}회` : null,
    video.publishedAt ? formatRelativeTime(video.publishedAt, now) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
