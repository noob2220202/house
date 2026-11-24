import { ASSET_TYPE_LABEL, type AssetType } from '@house/shared';
import { Icon, Tag, cx } from '@house/ui';
import { formatPhone } from '@/lib/format';
import type { Media } from '../api/schemas';
import { isOpenNow, summarizeBusinessHours, type BusinessHours } from '../lib/business-hours';
import { MediaImage } from './MediaImage';
import styles from './Profile.module.css';

export interface ProfilePreviewProps {
  name: string;
  representativeName: string;
  registrationNumber: string;
  address: string;
  phone: string;
  intro: string;
  specialties: readonly AssetType[];
  businessHours: BusinessHours | null;
  logo: Media | null;
  cover: Media | null;
  /** Local previews (object URLs) of fresh uploads that have no variants yet. */
  logoPreview?: string;
  coverPreview?: string;
}

/** Live preview of the public agency card (anatomy of the Agents design's profile drawer). */
export function ProfilePreview({
  name,
  representativeName,
  registrationNumber,
  address,
  phone,
  intro,
  specialties,
  businessHours,
  logo,
  cover,
  logoPreview,
  coverPreview,
}: ProfilePreviewProps) {
  const hours = summarizeBusinessHours(businessHours);
  const open = isOpenNow(businessHours);
  const short = name.replace(/\s*공인중개사\s*사무소$/, '').slice(0, 2) || name.slice(0, 2);
  return (
    <article className={styles.preview} aria-label="공개 프로필 미리보기">
      <div className={styles.pvCover}>
        {cover ? (
          <MediaImage
            media={cover}
            alt=""
            sizes="360px"
            variant="medium"
            previewUrl={coverPreview}
          />
        ) : (
          <span className={styles.pvCoverEmpty} aria-hidden="true">
            <Icon name="store" size={40} />
          </span>
        )}
      </div>
      <div className={styles.pvBody}>
        <span className={cx(styles.pvLogo, logo && styles.logoFilled)}>
          {logo ? (
            // `medium` keeps the aspect ratio (thumb is a 4:3 cover crop that cuts wordmarks).
            <MediaImage
              media={logo}
              alt={`${name} 로고`}
              sizes="64px"
              variant="medium"
              fit="contain"
              previewUrl={logoPreview}
            />
          ) : (
            short
          )}
        </span>
        {specialties.length > 0 && (
          <Tag variant="accent" icon={<Icon name="star" size={14} />}>
            {specialties.map((s) => ASSET_TYPE_LABEL[s]).join('·')} 전문
          </Tag>
        )}
        <h3 className={styles.pvName}>{name}</h3>
        <p className={styles.pvMeta}>
          <span>
            대표 공인중개사 <b>{representativeName}</b>
          </span>
          <span className={cx(styles.pvPill, styles.pvOk)}>
            <Icon name="shield" size={14} />
            등록 확인
          </span>
          {hours && (
            <span className={cx(styles.pvPill, open ? styles.pvOk : styles.pvOff)}>
              <i aria-hidden="true" />
              {open ? '영업 중' : '영업 종료'}
            </span>
          )}
        </p>
        <p className={cx(styles.pvIntro, !intro && styles.pvEmpty)}>
          {intro || '소개글을 쓰면 여기에 보여요.'}
        </p>
        <dl className={styles.pvRows}>
          <div>
            <dt>
              <Icon name="clock" size={16} />
              영업시간
            </dt>
            <dd className={cx(!hours && styles.pvEmpty)}>{hours || '영업시간을 설정해 주세요'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="map-pin" size={16} />
              주소
            </dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt>
              <Icon name="phone" size={16} />
              전화
            </dt>
            <dd>{phone ? formatPhone(phone) : '-'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="shield" size={16} />
              등록번호
            </dt>
            <dd>{registrationNumber}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
