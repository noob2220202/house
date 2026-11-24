'use client';
import { Button, Icon, PremiumBadge, Spinner, cx, photoKindForAsset } from '@house/ui';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ROUTES } from '@/config/nav';
import { formatManwon, type AreaUnit } from '@/lib/format';
import type { ComplexSummary, ListingSummary } from '../../api/schemas';
import type { Placement } from '../../lib/geo';
import { dealKind, listingMeta, listingName, listingSub, priceText } from '../../lib/listing';
import { ymLabel as dealYmText } from '@/features/w-complex/lib/trend';
import { complexMeta } from '../panel/ComplexPanel';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { CoverPhoto, HeartButton } from '../shared';
import s from './map.module.css';

type PopoverPlacement = Placement;

const placedStyle = (p: PopoverPlacement | null): CSSProperties | undefined =>
  p ? ({ left: p.left, top: p.top, '--arrow-top': `${p.arrowTop}px` } as CSSProperties) : undefined;

const DEAL_TEXT_CLASS = {
  sale: 't-sale',
  jeonse: 't-jeonse',
  monthly: 't-monthly',
  presale: 't-presale',
} as const;
const DEAL_WORD = { sale: '매매', jeonse: '전세', monthly: '월세', presale: '분양권' } as const;

export interface SelectedComplexCardProps {
  complex: ComplexSummary;
  /** Listings matching the filters (the marker count). */
  matched: number | null;
  /** "분양·매매" when a deal filter is on, else null. */
  dealsLabel: string | null;
  placement: PopoverPlacement | null;
  favorite: boolean;
  onFavorite: () => void;
  onOpenList: () => void;
  onClose: () => void;
  ref?: React.Ref<HTMLElement>;
}

/**
 * Complex popover next to its marker (MapApt design `.map-pop`). Docks bottom-left when the marker
 * is off screen. A non-modal dialog: the page moves focus into it when it opens from a marker and
 * closes it on Escape (focus returns to the marker).
 */
export function SelectedComplexCard({
  complex: c,
  matched,
  dealsLabel,
  placement,
  favorite,
  onFavorite,
  onOpenList,
  onClose,
  ref,
}: SelectedComplexCardProps) {
  const all = c.counts.presale + c.counts.sale + c.counts.jeonse + c.counts.monthly;
  const count = matched ?? all;
  const presale = !c.salePrice && !!c.presalePrice;
  const headline = c.salePrice ?? c.presalePrice ?? c.jeonsePrice;
  const headKind = c.salePrice ? 'sale' : c.presalePrice ? 'presale' : 'jeonse';
  const trade = c.latestTrade;
  return (
    <section
      ref={ref}
      role="dialog"
      tabIndex={-1}
      data-map-pop=""
      className={cx(s.pop, placement ? s[placement.side] : s.docked)}
      style={placedStyle(placement)}
      aria-label={`${c.name} 요약`}
    >
      <div className={s.popHd}>
        <div>
          <Link href={ROUTES.complex(c.id)} className={s.popTitle}>
            {c.name}
          </Link>
          <p className="t-cap">
            {[c.emdName?.split(' ').pop(), complexMeta(c).replace(' 준공', '')]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <HeartButton
          className={s.popIc}
          on={favorite}
          label={favoriteLabel('complexes', c.name, favorite)}
          onClick={onFavorite}
        />
        <button type="button" className={s.popIc} aria-label="요약 닫기" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className={s.popTiles}>
        {headline && (
          <span className={s.popTile}>
            <em className={DEAL_TEXT_CLASS[headKind]}>{DEAL_WORD[headKind]}</em>
            <b className="num">{formatManwon(headline.min)}~</b>
          </span>
        )}
        {c.pricePerPyeong ? (
          <span className={s.popTile}>
            <em className={s.popMuted}>{presale ? '분양권 평당' : '평당 시세'}</em>
            <b className="num">{Math.round(c.pricePerPyeong).toLocaleString('ko-KR')}만</b>
          </span>
        ) : null}
      </div>
      {trade && (
        <p className={s.popRecent}>
          <span>최근 실거래{trade.pyeongLabel ? ` · ${trade.pyeongLabel}평` : ''}</span>
          <span>
            <b className="num">{formatManwon(trade.price)}</b>
            {trade.dealYm ? ` · ${dealYmText(trade.dealYm)}` : ''}
          </span>
        </p>
      )}
      <div className={s.popCta}>
        <Button block onClick={onOpenList} iconRight={<Icon name="arrow-right" size={18} />}>
          {dealsLabel ? `${dealsLabel} ` : '매물 '}
          {count.toLocaleString('ko-KR')}건 보기
        </Button>
        <p className="t-cap">
          전체 거래 {all.toLocaleString('ko-KR')}건
          {c.counts.presale > 0 && ` · 분양 ${c.counts.presale}`}
          {c.counts.jeonse > 0 && ` · 전세 ${c.counts.jeonse}`}
          {c.counts.monthly > 0 && ` · 월세 ${c.counts.monthly}`}
        </p>
      </div>
    </section>
  );
}

export interface SelectedListingCardProps {
  /** Listings behind the selected pill; `index` is the one shown. */
  listings: readonly ListingSummary[];
  /** The pill stands for several neighbouring buildings (merged at this zoom), not one. */
  merged?: boolean;
  index: number;
  onIndexChange: (index: number) => void;
  loading: boolean;
  unit: AreaUnit;
  placement: PopoverPlacement | null;
  favorite: boolean;
  onFavorite: (id: string) => void;
  onClose: () => void;
  ref?: React.Ref<HTMLElement>;
}

/**
 * Listing preview next to its marker (OneRoom design `.rpop`), with a pager for buildings with
 * several rooms (or neighbouring buildings merged into one pill). Non-modal dialog like the complex
 * popover.
 */
export function SelectedListingCard({
  listings,
  merged,
  index,
  onIndexChange,
  loading,
  unit,
  placement,
  favorite,
  onFavorite,
  onClose,
  ref,
}: SelectedListingCardProps) {
  const l = listings[index];
  const kind = l ? dealKind(l) : 'monthly';
  const name = l ? listingName(l) : '';
  return (
    <section
      ref={ref}
      role="dialog"
      tabIndex={-1}
      data-map-pop=""
      className={cx(s.rpop, placement ? s[placement.side] : s.docked)}
      style={placedStyle(placement)}
      aria-label={l ? `${name} 미리보기` : '매물 미리보기'}
      aria-busy={loading && !l}
    >
      <button type="button" className={s.rpopX} aria-label="미리보기 닫기" onClick={onClose}>
        <Icon name="close" size={18} />
      </button>
      {!l ? (
        <div className={s.rpopLoading}>
          {loading ? <Spinner /> : <p className="t-sm">매물 정보를 찾지 못했어요.</p>}
        </div>
      ) : (
        <>
          <div className={s.rpopRow}>
            <span className={s.rpopTh}>
              <CoverPhoto
                url={l.coverPhotoUrl}
                alt={`${name} 사진`}
                sizes="76px"
                placeholder={photoKindForAsset(l.assetType)}
              />
            </span>
            <div className={s.rpopTx}>
              <p className={s.rpopP}>
                <span className={DEAL_TEXT_CLASS[kind]}>{DEAL_WORD[kind]}</span>{' '}
                <span className="num">{priceText(l)}</span>
                {l.premium != null && kind === 'presale' && <PremiumBadge amount={l.premium} />}
              </p>
              <p className={s.rpopM}>{listingMeta(l, unit).slice(0, 3).join(' · ')}</p>
              <p className={s.rpopS}>{listingSub(l)}</p>
            </div>
          </div>
          {listings.length > 1 && (
            <div
              className={s.pager}
              role="group"
              aria-label={merged ? '이 위치의 다른 매물' : '같은 건물의 다른 매물'}
            >
              <button
                type="button"
                aria-label="이전 매물"
                disabled={index === 0}
                onClick={() => onIndexChange(index - 1)}
              >
                <Icon name="chevron-left" size={16} />
              </button>
              <span className="num" aria-live="polite">
                {merged ? '이 위치' : '이 건물'} 매물 <b>{index + 1}</b> / {listings.length}
              </span>
              <button
                type="button"
                aria-label="다음 매물"
                disabled={index >= listings.length - 1}
                onClick={() => onIndexChange(index + 1)}
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
          )}
          <div className={s.rpopActs}>
            <Button
              variant="ink"
              size="sm"
              href={ROUTES.listing(l.id)}
              linkAs={Link}
              iconRight={<Icon name="arrow-right" size={16} />}
            >
              매물 상세 보기
            </Button>
            <HeartButton
              className={s.rpopHeart}
              on={favorite}
              size={18}
              label={favoriteLabel('listings', name, favorite)}
              onClick={() => onFavorite(l.id)}
            />
          </div>
        </>
      )}
    </section>
  );
}
