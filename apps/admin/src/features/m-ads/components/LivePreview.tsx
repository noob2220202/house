import type { BannerSlot } from '@house/shared';
import { cx, Icon } from '@house/ui';
import type { CSSProperties, ReactNode } from 'react';
import { env } from '@/config/env';
import type { BannerSlotInfo } from '../api/schemas';
import { SLOT_META, type SlotPreviewKind } from '../lib/slots';
import { AdImage } from './AdImage';
import styles from './editor.module.css';

const Sk = ({ w, h, tone }: { w: number | string; h: number; tone?: 'dk' | 'card' }) => (
  <i
    className={cx(styles.sk, tone === 'dk' && styles.dk, tone === 'card' && styles.card)}
    style={{ width: w, height: h }}
  />
);

/** The ad frame: the uploaded image, or a striped placeholder with the title while there is none. */
export function Creative({
  src,
  ratio,
  title,
  style,
}: {
  src: string | null;
  ratio: number;
  title: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx(styles.cr, !src && styles.crEmpty)}
      style={{ aspectRatio: String(ratio), ...style }}
    >
      {src ? <AdImage src={src} alt="" sizes="280px" /> : <span>{title || '이미지 없음'}</span>}
    </span>
  );
}

function DeskFrame({ children }: { children: ReactNode }) {
  return (
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
          <Sk w={14} h={4} />
          <i className={styles.pvPill} />
        </div>
        {children}
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.pvPhone} aria-hidden="true">
      <div className={styles.pvMgnb}>
        <i className={styles.pvMark} />
        <Sk w={16} h={4} tone="dk" />
        <span className={styles.pvSp} />
        <i className={cx(styles.pvPill, styles.b)} />
        <i className={styles.pvPill} />
      </div>
      <div className={styles.pvMbody}>{children}</div>
    </div>
  );
}

const Cards = () => (
  <div className={styles.pvCards}>
    <i />
    <i />
    <i />
    <i />
    <i />
  </div>
);
const Hero = () => (
  <div className={styles.pvHero}>
    <Sk w="46%" h={6} tone="dk" />
    <Sk w="30%" h={4} />
    <i className={styles.pvSearch} />
  </div>
);

/** Desktop page skeleton with the slot in its real position. */
function deskLayout(kind: SlotPreviewKind, slot: ReactNode): ReactNode {
  switch (kind) {
    case 'hero':
      return (
        <>
          <Hero />
          {slot}
          <Cards />
        </>
      );
    case 'strip':
      return (
        <>
          <Hero />
          <Cards />
          {slot}
          <Cards />
        </>
      );
    case 'map':
      return (
        <div className={styles.pvMap}>
          <i style={{ left: '58%', top: '26%' }} />
          <i style={{ left: '78%', top: '62%' }} />
          <i style={{ left: '44%', top: '70%' }} />
          <div className={styles.pvMapList}>
            <Sk w="80%" h={4} tone="dk" />
            <Sk w="100%" h={10} tone="card" />
            <Sk w="100%" h={10} tone="card" />
          </div>
          <div className={styles.pvMapSlot} style={{ left: '26%' }}>
            {slot}
          </div>
        </div>
      );
    case 'complex':
      return (
        <div className={styles.pvCols}>
          <div className={styles.pvCol}>
            <Sk w="60%" h={6} tone="dk" />
            <Sk w="100%" h={44} tone="card" />
            <Sk w="100%" h={18} tone="card" />
          </div>
          <div className={styles.pvCol}>
            <Sk w="70%" h={4} tone="dk" />
            {slot}
            <Sk w="100%" h={14} tone="card" />
            <Sk w="100%" h={14} tone="card" />
          </div>
        </div>
      );
    case 'listing':
      return (
        <div className={styles.pvCols}>
          <div className={styles.pvCol}>
            <Sk w="100%" h={56} tone="card" />
            <Sk w="70%" h={5} tone="dk" />
            <Sk w="90%" h={4} />
            <Sk w="50%" h={4} />
          </div>
          <div className={styles.pvCol}>
            <Sk w="100%" h={22} tone="card" />
            {slot}
          </div>
        </div>
      );
    case 'agencies':
      return (
        <>
          <Sk w="34%" h={6} tone="dk" />
          {slot}
          <Sk w="100%" h={14} tone="card" />
          <Sk w="100%" h={14} tone="card" />
          <Sk w="100%" h={14} tone="card" />
        </>
      );
    default:
      return null;
  }
}

/** Phone skeleton with the slot in its real position. */
function phoneLayout(kind: SlotPreviewKind, slot: ReactNode): ReactNode {
  switch (kind) {
    case 'map':
      return <div className={styles.pvMmap}>{slot}</div>;
    case 'strip':
      return (
        <>
          <Sk w="62%" h={6} tone="dk" />
          <i className={styles.pvSearch} />
          <Sk w="100%" h={26} tone="card" />
          {slot}
          <Sk w="100%" h={22} tone="card" />
        </>
      );
    case 'complex':
      return (
        <>
          <Sk w="62%" h={6} tone="dk" />
          <Sk w="100%" h={34} tone="card" />
          <Sk w="50%" h={4} tone="dk" />
          {slot}
          <Sk w="100%" h={18} tone="card" />
        </>
      );
    case 'agencies':
      return (
        <>
          <Sk w="54%" h={6} tone="dk" />
          {slot}
          <Sk w="100%" h={22} tone="card" />
          <Sk w="100%" h={22} tone="card" />
          <Sk w="100%" h={22} tone="card" />
        </>
      );
    default:
      return (
        <>
          <Sk w="62%" h={6} tone="dk" />
          <i className={styles.pvSearch} />
          {slot}
          <Sk w="100%" h={22} tone="card" />
          <Sk w="100%" h={22} tone="card" />
        </>
      );
  }
}

export interface LivePreviewProps {
  slot: BannerSlot;
  info: BannerSlotInfo | undefined;
  title: string;
  pcUrl: string | null;
  mobileUrl: string | null;
  /** 1-based position inside the slot. */
  position: number;
}

/**
 * 실시간 미리보기: miniature desktop + phone pages with the slot highlighted where it really sits,
 * showing the images exactly as the form currently holds them.
 */
export function LivePreview({ slot, info, title, pcUrl, mobileUrl, position }: LivePreviewProps) {
  const meta = SLOT_META[slot];
  const kind = meta.preview;
  const pc = info?.pc ?? { width: 1240, height: 220 };
  const mobile = info?.mobile ?? null;
  const mobileOnly = kind === 'mobile';
  const showDesk = !mobileOnly;
  const fallback = !mobileUrl && !!pcUrl && !mobileOnly;
  const phoneSrc = mobileOnly ? pcUrl : (mobileUrl ?? pcUrl);
  const phoneRatio = mobileOnly ? pc.width / pc.height : mobile ? mobile.width / mobile.height : 1;
  const label = info?.label ?? '';

  return (
    <section className={styles.pv} aria-labelledby="ads-pv-h">
      <div className={styles.pvHd}>
        <h3 id="ads-pv-h" className={styles.pvT}>
          실시간 미리보기
        </h3>
        <span className={styles.pvCap}>입력한 내용이 바로 반영돼요</span>
        <a
          className={styles.pvLink}
          href={`${env.siteUrl}${meta.sitePath}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="external-link" size={16} />
          실제 화면
        </a>
      </div>
      <div className={styles.pvStage}>
        {showDesk && (
          <figure className={cx(styles.pvFig, styles.pvFigDesk)}>
            <DeskFrame>
              {deskLayout(
                kind,
                <div className={styles.pvSlot}>
                  <Creative src={pcUrl} ratio={pc.width / pc.height} title={title} />
                </div>,
              )}
            </DeskFrame>
            <figcaption>
              <Icon name="expand" size={14} />
              PC · {label} {position}번째
            </figcaption>
          </figure>
        )}
        <figure className={cx(styles.pvFig, styles.pvFigM)}>
          {mobile || mobileOnly ? (
            <PhoneFrame>
              {phoneLayout(
                kind,
                <div className={styles.pvSlot}>
                  <Creative src={phoneSrc} ratio={phoneRatio} title={title} />
                </div>,
              )}
            </PhoneFrame>
          ) : (
            <div className={styles.pvOff}>
              모바일에는
              <br />
              노출되지 않아요
            </div>
          )}
          {mobile || mobileOnly ? (
            <figcaption className={fallback ? styles.warn : undefined}>
              <Icon name={fallback ? 'alert' : 'phone'} size={14} />
              {fallback
                ? 'PC 이미지로 대체 중'
                : mobileOnly
                  ? `모바일 · ${position}번째`
                  : '모바일'}
            </figcaption>
          ) : (
            <figcaption>
              <Icon name="minus" size={14} />
              모바일 미노출
            </figcaption>
          )}
        </figure>
      </div>
    </section>
  );
}
