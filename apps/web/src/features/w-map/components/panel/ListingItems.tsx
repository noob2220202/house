'use client';
import {
  BrokersBadge,
  DealBadge,
  Icon,
  PremiumBadge,
  Skeleton,
  VerifiedBadge,
  cx,
  photoKindForAsset,
} from '@house/ui';
import Link from 'next/link';
import type { Ref } from 'react';
import { ROUTES } from '@/config/nav';
import { formatDateShort, type AreaUnit } from '@/lib/format';
import type { ListingSummary } from '../../api/schemas';
import {
  dealKind,
  feeText,
  listingMeta,
  listingName,
  listingSub,
  perPyeongText,
  priceText,
  priceTextLabeled,
} from '../../lib/listing';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { CoverPhoto, HeartButton } from '../shared';
import s from './items.module.css';

export interface ListingItemProps {
  listing: ListingSummary;
  unit: AreaUnit;
  selected?: boolean;
  favorite: boolean;
  onFavorite: (id: string) => void;
  ref?: Ref<HTMLElement>;
}

const DEAL_TEXT_CLASS = {
  sale: 't-sale',
  jeonse: 't-jeonse',
  monthly: 't-monthly',
  presale: 't-presale',
} as const;
const DEAL_WORD = { sale: '매매', jeonse: '전세', monthly: '월세', presale: '분양권' } as const;

/** Photo card for the 2-column list (OneRoom design `.rc`). The whole card links to the listing. */
export function ListingPhotoCard({
  listing: l,
  unit,
  selected,
  favorite,
  onFavorite,
  ref,
}: ListingItemProps) {
  const name = listingName(l);
  const kind = dealKind(l);
  // Right of the price: 관리비 for rooms / shops, 평당가 for land.
  const sideNote =
    perPyeongText(l) ?? (!l.complexId && l.maintenanceFeeWon ? feeText(l.maintenanceFeeWon) : null);
  return (
    <article
      ref={ref}
      className={cx(s.card, selected && s.cardOn)}
      aria-current={selected ? 'true' : undefined}
    >
      <div className={s.photo}>
        <CoverPhoto
          url={l.coverPhotoUrl}
          alt={`${name} 사진`}
          sizes="(max-width: 1100px) 40vw, 260px"
          placeholder={photoKindForAsset(l.assetType)}
        />
        <BrokersBadge count={l.agencyCount} className={s.cardBrokers} />
        <HeartButton
          className={s.cardHeart}
          on={favorite}
          label={favoriteLabel('listings', name, favorite)}
          onClick={() => onFavorite(l.id)}
        />
        {(l.photoCount > 0 || l.sameBuildingCount > 0) && (
          <span className={s.more}>
            {l.photoCount > 0 && (
              <>
                <Icon name="image" size={14} />
                <span className="sr-only">사진 </span>
                <span className="num">{l.photoCount}</span>
              </>
            )}
            {l.sameBuildingCount > 0 && (
              <>
                {l.photoCount > 0 && <i aria-hidden="true">·</i>}
                <span>같은 건물 다른 방</span>
                <b className="num">+{l.sameBuildingCount}</b>
              </>
            )}
          </span>
        )}
      </div>
      <div className={s.body}>
        <h3 className={s.price}>
          <Link href={ROUTES.listing(l.id)} className={s.stretch}>
            <span className={DEAL_TEXT_CLASS[kind]}>{DEAL_WORD[kind]}</span>{' '}
            <span className="num">{priceText(l)}</span>
          </Link>
          {l.premium !== null && l.premium !== undefined && kind === 'presale' && (
            <PremiumBadge amount={l.premium} className={s.prem} />
          )}
          {sideNote && <span className={s.fee}>{sideNote}</span>}
        </h3>
        <p className={s.meta}>
          {listingMeta(l, unit, { fee: false }).map((m) => (
            <span key={m}>{m}</span>
          ))}
        </p>
        <p className={s.sub}>{listingSub(l)}</p>
        {l.locationNote && (
          <p className={s.near}>
            <Icon name="map-pin" size={16} />
            {l.locationNote}
          </p>
        )}
        <div className={s.ver}>
          {l.verifiedAt ? (
            <VerifiedBadge date={formatDateShort(l.verifiedAt)} />
          ) : (
            <span className={s.unverified}>실매물 확인 전</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Compact row (MobileMap `.ms-row`): thumbnail + deal badge + price + facts + 실매물 확인. */
export function ListingRow({
  listing: l,
  unit,
  selected,
  favorite,
  onFavorite,
  showName,
  ref,
}: ListingItemProps & {
  /** Print the building / location line (non-complex lists). */ showName?: boolean;
}) {
  const name = listingName(l);
  const kind = dealKind(l);
  return (
    <article
      ref={ref}
      className={cx(s.row, selected && s.rowOn)}
      aria-current={selected ? 'true' : undefined}
    >
      <span className={s.thumb}>
        <CoverPhoto
          url={l.coverPhotoUrl}
          alt={`${name} 사진`}
          sizes="72px"
          placeholder={photoKindForAsset(l.assetType)}
        />
        {l.photoCount > 0 && (
          <span className={s.cnt}>
            <span className="sr-only">사진 </span>
            {l.photoCount}
          </span>
        )}
      </span>
      <span className={s.rowMain}>
        <span className={s.rowPrice}>
          <DealBadge deal={kind} />
          <Link
            href={ROUTES.listing(l.id)}
            className={cx(s.stretch, s.rowLink)}
            aria-label={`${name} ${priceTextLabeled(l)} 상세 보기`}
          >
            <b className={cx('price', 'num', s.rowAmount)}>{priceText(l)}</b>
          </Link>
          {l.premium !== null && l.premium !== undefined && kind === 'presale' && (
            <PremiumBadge amount={l.premium} />
          )}
          <BrokersBadge count={l.agencyCount} light className={s.rowBrokers} />
        </span>
        <span className={s.rowFacts}>
          {listingMeta(l, unit).map((m) => (
            <span key={m}>{m}</span>
          ))}
        </span>
        {showName && <span className={s.rowSub}>{l.locationNote ?? listingSub(l)}</span>}
        {l.verifiedAt && (
          <span className={s.rowVerified}>
            <Icon name="check-circle" size={14} />
            실매물 확인 {formatDateShort(l.verifiedAt)}
          </span>
        )}
      </span>
      <HeartButton
        className={s.rowHeart}
        on={favorite}
        size={18}
        label={favoriteLabel('listings', name, favorite)}
        onClick={() => onFavorite(l.id)}
      />
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className={s.card} aria-hidden="true">
      <Skeleton height="auto" radius={14} style={{ aspectRatio: '16 / 9' }} />
      <div className={s.body}>
        <Skeleton width="55%" height={26} />
        <Skeleton width="80%" height={16} />
        <Skeleton width="65%" height={14} />
        <Skeleton width="45%" height={14} />
      </div>
    </div>
  );
}

export function ListingRowSkeleton() {
  return (
    <div className={s.row} aria-hidden="true">
      <Skeleton width={60} height={60} radius={12} />
      <span className={s.rowMain}>
        <Skeleton width="50%" height={22} />
        <Skeleton width="75%" height={14} />
        <Skeleton width="40%" height={12} />
      </span>
    </div>
  );
}
