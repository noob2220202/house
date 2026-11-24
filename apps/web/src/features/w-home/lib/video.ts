import { parseYoutubeVideoId } from '@house/shared';
import { ROUTES } from '@/config/nav';
import { formatRelativeTime } from '@/lib/format/date';
import { formatCompactCount, formatDuration } from '@/lib/format/number';
import type { VideoItem } from '../api/schemas';

/** Shared video-length formatter ("14:32", "1:02:05"). */
export { formatDuration };

export interface VideoCardModel {
  id: string;
  title: string;
  href: string;
  thumbnailUrl: string | null;
  duration?: string;
  /** "조회수 1.2만회 · 3일 전" */
  caption: string;
  channelName?: string;
}

/** Stored thumbnail → YouTube's own still → none (branded placeholder). */
export function videoThumbnail(v: VideoItem): string | null {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  const id = v.youtubeVideoId || (v.youtubeUrl ? parseYoutubeVideoId(v.youtubeUrl) : null);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function toVideoCard(v: VideoItem, now: Date = new Date()): VideoCardModel {
  const parts = [
    typeof v.viewCount === 'number' ? `조회수 ${formatCompactCount(v.viewCount)}회` : null,
    v.publishedAt ? formatRelativeTime(v.publishedAt, now) : null,
  ].filter(Boolean);
  return {
    id: v.id,
    title: v.title,
    // The 동네TV page (w-content) plays the video in place.
    href: `${ROUTES.videos}?v=${encodeURIComponent(v.id)}`,
    thumbnailUrl: videoThumbnail(v),
    duration: typeof v.durationSeconds === 'number' ? formatDuration(v.durationSeconds) : undefined,
    caption: parts.join(' · '),
    channelName: v.channelName ?? undefined,
  };
}
