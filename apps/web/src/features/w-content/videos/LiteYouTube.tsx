'use client';
import { cx } from '@house/ui';
import { useState } from 'react';
import { BRAND } from '@/config/brand';
import type { Video } from '../api/schemas';
import { VideoThumb } from './VideoThumb';
import { formatDuration, spokenDuration, youtubeEmbedUrl, youtubeIdOf } from './video-utils';
import styles from './videos.module.css';

export interface LiteYouTubeProps {
  video: Video;
  /** Start playing right away (the visitor already chose this video with a click). */
  autoPlay?: boolean;
  className?: string;
}

/**
 * "Lite" YouTube embed: only a thumbnail and a play button are rendered until the visitor presses
 * play — the YouTube iframe (≈1MB of scripts, cookies) is loaded on demand from the
 * privacy-enhanced youtube-nocookie.com host.
 */
export function LiteYouTube({ video, autoPlay = false, className }: LiteYouTubeProps) {
  const [playing, setPlaying] = useState(autoPlay);
  const id = youtubeIdOf(video);

  if (playing && id) {
    return (
      <div className={cx(styles.player, className)}>
        <iframe
          className={styles.frame}
          src={youtubeEmbedUrl(id)}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cx(styles.player, styles.poster, className)}
      onClick={() => setPlaying(true)}
      disabled={!id}
      aria-label={`${video.title} 재생`}
    >
      <VideoThumb video={video} priority sizes="(max-width: 720px) 100vw, 760px" />
      <span className={styles.playBig} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
        </svg>
      </span>
      {typeof video.durationSeconds === 'number' && (
        <span className={cx(styles.dur, styles.durBig)}>
          <span className="sr-only">재생 시간 {spokenDuration(video.durationSeconds)}</span>
          <span aria-hidden="true">{formatDuration(video.durationSeconds)}</span>
        </span>
      )}
    </button>
  );
}

/** Channel avatar chip ("동네") used next to the featured title — same as Main `.ch`. */
export function ChannelMark() {
  return (
    <span className={styles.ch} aria-hidden="true">
      {BRAND.tvName.replace(/TV$/i, '').trim().slice(-2)}
    </span>
  );
}
