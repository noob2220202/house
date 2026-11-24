import { Icon, cx } from '@house/ui';
import Image from 'next/image';
import styles from './VideosView.module.css';

/** 16:9 still of a video; decorative (the title is right next to it). */
export function VideoThumb({ url, off }: { url: string | null; off?: boolean }) {
  return (
    <span className={cx(styles.thumb, off && styles.thumbOff)}>
      {url ? (
        <Image src={url} alt="" fill sizes="144px" unoptimized />
      ) : (
        <span className={styles.noThumb}>
          <Icon name="image" size={22} />
        </span>
      )}
      <span className={styles.play} aria-hidden="true">
        <Icon name="play" size={12} filled />
      </span>
    </span>
  );
}
