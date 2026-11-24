import { Icon } from '@house/ui';
import Image from 'next/image';
import { BRAND } from '@/config/brand';
import type { Video } from '../api/schemas';
import { thumbnailOf } from './video-utils';
import styles from './videos.module.css';

export interface VideoThumbProps {
  video: Video;
  sizes: string;
  /** Above-the-fold image (the featured player). */
  priority?: boolean;
}

/**
 * 16:9 thumbnail filling its positioned parent. Falls back to a branded tile when the video has no
 * usable thumbnail. Thumbnails are remote YouTube stills (or operator uploads) that are already
 * sized, so they bypass the image optimizer.
 */
export function VideoThumb({ video, sizes, priority }: VideoThumbProps) {
  const src = thumbnailOf(video);
  if (!src) {
    return (
      <span className={styles.fallback}>
        <Icon name="play" size={28} />
        <span>{BRAND.tvName}</span>
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      unoptimized
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      className={styles.thumbImg}
    />
  );
}
