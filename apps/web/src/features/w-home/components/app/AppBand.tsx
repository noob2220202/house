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

const NOTICES = [
  {
    tone: 'brand',
    icon: 'bell',
    kind: '관심 단지',
    when: '방금',
    title: '신대 레이크파크 1단지 새 매물',
    text: '매매 4억 4,500 · 34평 · 고/25층',
  },
  {
    tone: 'ink',
    icon: 'chat',
    kind: '구하기 제안',
    when: '12분 전',
    title: '신대중앙 공인중개사사무소',
    text: '조건에 맞는 매물 2건을 제안했어요',
  },
  {
    tone: 'green',
    icon: 'check-circle',
    kind: '실매물 확인',
    when: '1시간 전',
    title: '선월 하이츠 2차 205동',
    text: '분양권 4억 1,900 · P +2,700',
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
                    <span className={styles.noticeKind}>
                      {n.kind}
                      <span>{n.when}</span>
                    </span>
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
