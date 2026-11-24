'use client';
import { Icon, cx } from '@house/ui';
import { useCallback, useRef, useState } from 'react';
import { ROUTES } from '@/config/nav';
import type { Video } from '../api/schemas';
import { ChannelMark, LiteYouTube } from './LiteYouTube';
import { VideoThumb } from './VideoThumb';
import {
  formatDuration,
  spokenDuration,
  videoCaption,
  youtubeIdOf,
  youtubeWatchUrl,
} from './video-utils';
import styles from './videos.module.css';

export interface VideoGalleryProps {
  videos: readonly Video[];
  /** Video selected through `?v=<id>`; defaults to the first one. */
  initialId?: string;
  /** Reference time (ISO) for "3일 전" so server and client render the same text. */
  now: string;
}

const UP_NEXT = 3;

/**
 * 동네TV: a featured lite player with the "다음 영상" list beside it (Main `.vids` layout) and the
 * full grid below. Choosing a video swaps the player in place, starts playback and keeps `?v=` in
 * the URL so the selection can be shared.
 */
export function VideoGallery({ videos, initialId, now }: VideoGalleryProps) {
  const first = videos.find((v) => v.id === initialId) ?? videos[0];
  const [selectedId, setSelectedId] = useState(first?.id);
  /** True once the visitor picked a video → the player starts immediately. */
  const [autoPlay, setAutoPlay] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setAutoPlay(true);
    const url = new URL(window.location.href);
    url.searchParams.set('v', id);
    window.history.replaceState(window.history.state, '', url);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stageRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  const selected = videos.find((v) => v.id === selectedId) ?? first;
  if (!selected) return null;

  const index = videos.findIndex((v) => v.id === selected.id);
  const upNext = Array.from({ length: Math.min(UP_NEXT, videos.length - 1) }, (_, i) => {
    return videos[(index + 1 + i) % videos.length]!;
  });
  const ytId = youtubeIdOf(selected);

  return (
    <>
      <div className={styles.stage} ref={stageRef} tabIndex={-1}>
        <div className={styles.feat}>
          <LiteYouTube key={selected.id} video={selected} autoPlay={autoPlay} />
          <div className={styles.featMeta}>
            <ChannelMark />
            <div className={styles.featText}>
              <h2 className={styles.featTitle} aria-live="polite">
                {selected.title}
              </h2>
              <p className="t-cap">{videoCaption(selected, now)}</p>
              {selected.description && <p className={styles.featDesc}>{selected.description}</p>}
              {ytId && (
                <a
                  className={cx('link', styles.external)}
                  href={youtubeWatchUrl(ytId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  YouTube에서 보기
                  <Icon name="external-link" size={16} />
                  <span className="sr-only">(새 창)</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {upNext.length > 0 && (
          <div className={styles.next}>
            <h2 className={styles.nextTitle}>다음 영상</h2>
            <ul className={styles.nextList}>
              {upNext.map((v) => (
                <li key={v.id}>
                  <VideoButton video={v} now={now} onSelect={select} layout="row" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <section className={styles.all} aria-labelledby="videos-all">
        <div className={styles.allHead}>
          <h2 id="videos-all" className="t-h3">
            전체 영상 <span className={styles.allCount}>{videos.length}</span>
          </h2>
        </div>
        <ul className={styles.grid}>
          {videos.map((v) => (
            <li key={v.id}>
              <VideoButton
                video={v}
                now={now}
                onSelect={select}
                layout="card"
                current={v.id === selected.id}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function VideoButton({
  video,
  now,
  onSelect,
  layout,
  current,
}: {
  video: Video;
  now: string;
  onSelect: (id: string) => void;
  layout: 'row' | 'card';
  current?: boolean;
}) {
  return (
    <a
      href={`${ROUTES.videos}?v=${encodeURIComponent(video.id)}`}
      className={cx(layout === 'row' ? styles.vrow : styles.vcard, current && styles.current)}
      aria-current={current ? 'true' : undefined}
      onClick={(e) => {
        // Plain left click → swap the player in place; modified clicks keep the normal link behaviour.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onSelect(video.id);
      }}
    >
      <span className={styles.vt}>
        <VideoThumb
          video={video}
          sizes={
            layout === 'row' ? '(max-width: 720px) 44vw, 240px' : '(max-width: 720px) 100vw, 400px'
          }
        />
        {current && (
          <span className={styles.nowPlaying}>
            <Icon name="play" size={14} />
            재생 중
          </span>
        )}
        {typeof video.durationSeconds === 'number' && (
          <span className={styles.dur}>
            <span className="sr-only">재생 시간 {spokenDuration(video.durationSeconds)}</span>
            <span aria-hidden="true">{formatDuration(video.durationSeconds)}</span>
          </span>
        )}
      </span>
      <span className={styles.vtext}>
        <b className={styles.vtitle}>{video.title}</b>
        <span className="t-cap">{videoCaption(video, now, layout === 'card')}</span>
      </span>
    </a>
  );
}
