import { agencySiteCssVars } from '@house/shared';
import { AgencyLogo, DealLabel, Icon } from '@house/ui';
import { OfficeCoverArt } from '@/features/w-agencies/components/OfficeCoverArt';
import type { Media } from '../api/schemas';
import { MediaImage } from '../profile/MediaImage';
import styles from './Site.module.css';

const PREVIEW_PRICES = [
  ['sale', '4억 4,500'],
  ['jeonse', '2억 8,000'],
] as const;

export interface SitePreviewProps {
  agencyId: string;
  name: string;
  representativeName: string;
  /** "sindae.suncheonmap.kr" (or a placeholder while nothing is typed). */
  host: string;
  color: string;
  tagline: string;
  logo: Media | null;
  cover: Media | null;
}

/**
 * Live miniature of the office site (header, hero, listing chips): the brand colour and 한 줄 소개
 * as typed, the logo and cover of the 사무소 프로필. Decorative copy of the real page, so the
 * office sees the colour on buttons, menus and the selected filter before saving. Prices keep the
 * text colour and the fixed deal colour, exactly like the listing cards of the site.
 */
export function SitePreview({
  agencyId,
  name,
  representativeName,
  host,
  color,
  tagline,
  logo,
  cover,
}: SitePreviewProps) {
  const logoNode = (size: number) => (
    <AgencyLogo
      name={name}
      seed={agencyId}
      size={size}
      fallback="initials"
      image={
        logo ? (
          <MediaImage media={logo} alt="" sizes={`${size}px`} variant="thumb" fit="contain" />
        ) : undefined
      }
    />
  );
  return (
    <figure
      className={styles.preview}
      style={agencySiteCssVars(color)}
      aria-label="홈페이지 미리보기"
    >
      <div className={styles.pvBar} aria-hidden="true">
        <span className={styles.pvDots}>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.pvUrl}>
          <Icon name="lock" size={12} />
          {host}
        </span>
      </div>
      <div className={styles.pvFrame} aria-hidden="true">
        <div className={styles.pvHeader}>
          {logoNode(24)}
          <b>{name}</b>
          <span className={styles.pvAsk}>문의하기</span>
        </div>
        <div className={styles.pvCover}>
          {cover ? (
            <MediaImage media={cover} alt="" sizes="360px" variant="medium" />
          ) : (
            <OfficeCoverArt />
          )}
        </div>
        <div className={styles.pvHero}>
          <span className={styles.pvLogo}>{logoNode(44)}</span>
          <b className={styles.pvName}>{name}</b>
          <p className={tagline ? styles.pvTagline : `${styles.pvTagline} ${styles.pvEmpty}`}>
            {tagline || '한 줄 소개를 적으면 여기에 보여요'}
          </p>
          <p className={styles.pvMeta}>대표 공인중개사 {representativeName}</p>
        </div>
        <div className={styles.pvList}>
          <div className={styles.pvChips}>
            <span className={styles.pvChipOn}>전체</span>
            <span>매매</span>
            <span>전세</span>
            <span>월세</span>
          </div>
          <div className={styles.pvCards}>
            {PREVIEW_PRICES.map(([deal, price]) => (
              <div key={deal} className={styles.pvCard}>
                <span className={styles.pvPhoto} />
                <b className={styles.pvPrice}>
                  <DealLabel deal={deal} className={styles.pvDeal} /> {price}
                </b>
                <span className={styles.pvLine} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className={styles.pvCaption}>실제 화면과 조금 다를 수 있어요</figcaption>
    </figure>
  );
}
