import { PopupPage } from '@house/shared';
import { cx, Icon } from '@house/ui';
import { env } from '@/config/env';
import { dismissLabel, POPUP_PAGE_LABEL, POPUP_PAGE_PATH } from '../lib/popup-form';
import { AdImage } from './AdImage';
import adsStyles from './ads.module.css';
import styles from './editor.module.css';

/** The popup as visitors see it: image + "N일 동안 보지 않기 │ 닫기" footer (design `.pp-mini`). */
export function PopupCard({
  src,
  title,
  dismissDays,
  className,
}: {
  src: string | null;
  title: string;
  dismissDays: number;
  className?: string;
}) {
  const dismiss = dismissLabel(dismissDays);
  return (
    <div className={cx(adsStyles.ppMini, className)} aria-hidden="true">
      <div className={cx(adsStyles.ppArt, !src && styles.crEmpty)}>
        {src ? <AdImage src={src} alt="" sizes="240px" /> : <span>{title || '이미지 없음'}</span>}
      </div>
      <div className={adsStyles.ppFt}>
        {dismiss && <span>{dismiss}</span>}
        <span>닫기</span>
      </div>
    </div>
  );
}

const Sk = ({ w, h, tone }: { w: number | string; h: number; tone?: 'dk' | 'card' }) => (
  <i
    className={cx(styles.sk, tone === 'dk' && styles.dk, tone === 'card' && styles.card)}
    style={{ width: w, height: h }}
  />
);

function MiniPopup({ src, className }: { src: string | null; className?: string }) {
  return (
    <div className={className}>
      <span className={cx(styles.pvPopArt, !src && styles.crEmpty)}>
        {src && <AdImage src={src} alt="" sizes="140px" />}
      </span>
      <span className={styles.pvPopFt}>
        <i />
        <i />
      </span>
    </div>
  );
}

export interface PopupPreviewProps {
  title: string;
  src: string | null;
  dismissDays: number;
  targetPages: readonly PopupPage[];
}

/** 실시간 미리보기 of a popup: full-size card + how it sits on a desktop page and a phone. */
export function PopupPreview({ title, src, dismissDays, targetPages }: PopupPreviewProps) {
  const first = targetPages[0] ?? PopupPage.MAIN;
  return (
    <section className={styles.pv} aria-labelledby="ads-pv-h">
      <div className={styles.pvHd}>
        <h3 id="ads-pv-h" className={styles.pvT}>
          실시간 미리보기
        </h3>
        <span className={styles.pvCap}>입력한 내용이 바로 반영돼요</span>
        <a
          className={styles.pvLink}
          href={`${env.siteUrl}${POPUP_PAGE_PATH[first]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="external-link" size={16} />
          실제 화면
        </a>
      </div>
      <div className={styles.pvStage}>
        <figure className={cx(styles.pvFig, styles.pvFigDesk)}>
          <div className={styles.pvDesk} aria-hidden="true">
            <div className={styles.pvChrome}>
              <i />
              <i />
              <i />
              <span />
            </div>
            <div className={styles.pvPage}>
              <div className={styles.pvGnb}>
                <i className={styles.pvMark} />
                <Sk w={22} h={4} tone="dk" />
                <span className={styles.pvSp} />
                <Sk w={14} h={4} />
                <Sk w={14} h={4} />
                <i className={styles.pvPill} />
              </div>
              <div className={styles.pvHero}>
                <Sk w="46%" h={6} tone="dk" />
                <Sk w="30%" h={4} />
                <i className={styles.pvSearch} />
              </div>
              <Sk w="100%" h={34} tone="card" />
              <div className={styles.pvCards}>
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className={styles.pvDim} />
              <MiniPopup src={src} className={styles.pvPopDesk} />
            </div>
          </div>
          <figcaption>
            <Icon name="expand" size={14} />
            PC · {POPUP_PAGE_LABEL[first]}
            {targetPages.length > 1 ? ` 외 ${targetPages.length - 1}` : ''}
          </figcaption>
        </figure>
        <figure className={cx(styles.pvFig, styles.pvFigM)}>
          <div className={styles.pvPhone} aria-hidden="true">
            <div className={styles.pvMgnb}>
              <i className={styles.pvMark} />
              <Sk w={16} h={4} tone="dk" />
              <span className={styles.pvSp} />
              <i className={cx(styles.pvPill, styles.b)} />
            </div>
            <div className={styles.pvMbody}>
              <Sk w="62%" h={6} tone="dk" />
              <i className={styles.pvSearch} />
              <Sk w="100%" h={40} tone="card" />
              <Sk w="100%" h={22} tone="card" />
              <Sk w="100%" h={22} tone="card" />
            </div>
            <span className={styles.pvDim} />
            <MiniPopup src={src} className={styles.pvPopM} />
          </div>
          <figcaption>
            <Icon name="phone" size={14} />
            모바일
          </figcaption>
        </figure>
      </div>
      <PopupCard src={src} title={title} dismissDays={dismissDays} className={styles.pvBig} />
    </section>
  );
}
