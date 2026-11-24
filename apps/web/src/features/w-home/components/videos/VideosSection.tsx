import { Icon } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import type { VideoItem } from '../../api/schemas';
import { imageProps } from '../../lib/media';
import { toVideoCard, type VideoCardModel } from '../../lib/video';
import { MoreLink, SectionHeader } from '../SectionHeader';
import styles from './Videos.module.css';

function Thumb({ video, big }: { video: VideoCardModel; big?: boolean }) {
  return (
    <span className={`${styles.thumb} ${big ? styles.big : ''}`}>
      {video.thumbnailUrl ? (
        <Image
          {...imageProps(video.thumbnailUrl)}
          alt=""
          fill
          sizes={big ? '(max-width: 720px) 256px, (max-width: 1100px) 100vw, 704px' : '256px'}
          loading="lazy"
        />
      ) : (
        <span className={styles.noThumb} aria-hidden="true">
          <Icon name="play" size={28} filled />
        </span>
      )}
      <span className={styles.play} aria-hidden="true">
        <Icon name="play" size={22} filled />
      </span>
      {video.duration && (
        <span className={styles.duration}>
          <span className="sr-only">재생 시간 </span>
          {video.duration}
        </span>
      )}
    </span>
  );
}

export interface VideosSectionProps {
  videos: readonly VideoItem[];
}

/**
 * "동네 소식 · 영상": 동네TV videos managed in the back-office. Desktop = one featured video +
 * a list (Main `.vids`); mobile = swipe row of cards (MobileHome `.hscroll--v`). One markup, CSS
 * switches the layout. Renders nothing when there are no published videos.
 */
export function VideosSection({ videos }: VideosSectionProps) {
  if (videos.length === 0) return null;
  const now = new Date();
  const [first, ...rest] = videos.map((v) => toVideoCard(v, now));
  if (!first) return null;
  const channel = first.channelName ?? BRAND.tvName;
  return (
    <section className={styles.section} aria-labelledby="home-vid-h">
      <div className="container">
        <SectionHeader
          id="home-vid-h"
          title="동네 소식 · 영상"
          caption={
            <>
              순천 중개사가 직접 다니며 전하는 <span className="only-lg">동네 </span>이야기
            </>
          }
          actions={<MoreLink href={ROUTES.videos}>{BRAND.tvName} 채널 보기</MoreLink>}
          mobileMore={{
            href: ROUTES.videos,
            label: '채널',
            ariaLabel: `${BRAND.tvName} 채널 보기`,
          }}
        />
        <ul className={styles.videos} aria-label={`${BRAND.tvName} 영상`}>
          <li className={styles.featured}>
            <Link href={first.href} className={styles.card}>
              <Thumb video={first} big />
              <span className={styles.meta}>
                <span className={styles.channel} aria-hidden="true">
                  동네
                </span>
                <span className={styles.text}>
                  <b className={`${styles.title} ${styles.titleLg}`}>{first.title}</b>
                  <span className={styles.caption}>
                    <span className="only-lg">{channel} · </span>
                    {first.caption}
                  </span>
                </span>
              </span>
            </Link>
          </li>
          {rest.map((v) => (
            <li key={v.id} className={styles.item}>
              <Link href={v.href} className={`${styles.card} ${styles.row}`}>
                <Thumb video={v} />
                <span className={styles.text}>
                  <b className={styles.title}>{v.title}</b>
                  <span className={styles.caption}>
                    <span className="only-lg">{v.channelName ?? channel} · </span>
                    {v.caption}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
