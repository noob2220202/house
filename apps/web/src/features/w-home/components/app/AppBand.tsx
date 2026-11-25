import { Icon } from '@house/ui';
import { isSafeLinkUrl } from '@house/shared';
import { BRAND } from '@/config/brand';
import styles from './AppBand.module.css';

const AppleGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2-1.1 2.8-2.3.9-1.3 1.2-2.5 1.2-2.6 0 0-2.4-.9-2.4-3.8zM14.2 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"
    />
  </svg>
);
const PlayGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M5 3.6v16.8c0 .5.5.8 1 .5l14.2-8.4c.4-.3.4-.8 0-1L6 3.1c-.5-.3-1 0-1 .5z"
    />
  </svg>
);

/**
 * The phone mock illustrates the kinds of notices the app sends — feature copy only, never a
 * listing, an office, a price or a time that could be read as a real event.
 */
const NOTICES = [
  {
    tone: 'brand',
    icon: 'bell',
    kind: '관심 단지',
    title: '관심 단지 새 매물 알림',
    text: '찜한 단지에 매물이 오르면 바로 알려요',
  },
  {
    tone: 'ink',
    icon: 'chat',
    kind: '구하기 제안',
    title: '구하기 제안 도착',
    text: '조건에 맞는 매물을 중개사무소가 제안해요',
  },
  {
    tone: 'green',
    icon: 'check-circle',
    kind: '실매물 확인',
    title: '실매물 확인 완료 알림',
    text: '관심 매물이 다시 확인되면 알려요',
  },
] as const;

/** Store links are absolute http(s) URLs only (a site-relative value is a settings mistake). */
function storeUrl(url: string | null): string | null {
  return url && /^https?:\/\/[^\\\s]+$/i.test(url) && isSafeLinkUrl(url) ? url : null;
}

export interface AppBandProps {
  /** Store links from the site settings. The band is only rendered when at least one is set. */
  iosUrl: string | null;
  androidUrl: string | null;
}

/** App download band (Main.dc.html `.app`). Shown only when the operator configured store links. */
export function AppBand({ iosUrl, androidUrl }: AppBandProps) {
  const ios = storeUrl(iosUrl);
  const android = storeUrl(androidUrl);
  if (!ios && !android) return null;
  return (
    <section className={styles.section} aria-labelledby="home-app-h">
      <div className="container">
        <div className={styles.band}>
          <div className={styles.copy}>
            <p className={styles.kicker}>{BRAND.name} 앱</p>
            <h2 id="home-app-h" className={styles.title}>
              관심 단지에 새 매물이 올라오면
              <br />
              가장 먼저 알려드려요
            </h2>
            <p className={styles.lead}>
              실매물 확인 알림, 중개사 채팅, 내놓기·구하기 진행 상황까지 앱에서 받아보세요.
            </p>
            <div className={styles.buttons}>
              {ios && (
                <a className={styles.store} href={ios} target="_blank" rel="noopener noreferrer">
                  <AppleGlyph />
                  <span>
                    <small>Download on the</small>App Store
                  </span>
                </a>
              )}
              {android && (
                <a
                  className={styles.store}
                  href={android}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PlayGlyph />
                  <span>
                    <small>GET IT ON</small>Google Play
                  </span>
                </a>
              )}
            </div>
          </div>
          <div className={styles.phone} aria-hidden="true">
            <div className={styles.screen}>
              <div className={styles.phoneHead}>
                <b>알림</b>
                <span>모두 읽음</span>
              </div>
              {NOTICES.map((n) => (
                <span key={n.title} className={styles.notice}>
                  <span className={`${styles.noticeIcon} ${styles[n.tone]}`}>
                    <Icon name={n.icon} size={16} />
                  </span>
                  <span className={styles.noticeBody}>
                    <span className={styles.noticeKind}>{n.kind}</span>
                    <b>{n.title}</b>
                    <span>{n.text}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
