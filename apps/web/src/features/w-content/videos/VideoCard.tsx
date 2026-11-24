import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { Video } from '../api/schemas';
import { VideoThumb } from './VideoThumb';
import { formatDuration, spokenDuration, videoCaption } from './video-utils';
import styles from './videos.module.css';

/** Video card linking to the 동네TV player (`/videos?v=<id>`) — same anatomy as the gallery grid. */
export function VideoCard({ video, now }: { video: Video; now: string }) {
  return (
    <Link href={`${ROUTES.videos}?v=${encodeURIComponent(video.id)}`} className={styles.vcard}>
      <span className={styles.vt}>
        <VideoThumb
          video={video}
          sizes="(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 400px"
        />
        {typeof video.durationSeconds === 'number' && (
          <span className={styles.dur}>
            <span className="sr-only">재생 시간 {spokenDuration(video.durationSeconds)}</span>
            <span aria-hidden="true">{formatDuration(video.durationSeconds)}</span>
          </span>
        )}
      </span>
      <span className={styles.vtext}>
        <b className={styles.vtitle}>{video.title}</b>
        <span className="t-cap">{videoCaption(video, now)}</span>
      </span>
    </Link>
  );
}
