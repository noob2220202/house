'use client';
import { ASSET_TYPE_LABEL, DEAL_TYPE_LABEL, DealRequestVisibility } from '@house/shared';
import { Badge, DealBadge, Icon, PhotoPlaceholder, dealKindOf } from '@house/ui';
import Image from 'next/image';
import { formatAreaBoth, formatDateKorean, formatSqm } from '@/lib/format';
import { parseMoney } from '../../lib/form-common';
import { VISIBILITY_LABEL } from '../../lib/labels';
import { displayAddress } from '../../lib/service-area';
import {
  isComplexAsset,
  sellAddressDetail,
  sellExclusiveSqm,
  sellPriceLabel,
  sellProgress,
  type SellFormValues,
} from '../../lib/sell-form';
import styles from '../form/form.module.css';
import { sellPhotoKind, sellPriceText } from './SellSteps';

export function sellMoveInText(v: SellFormValues): string {
  if (v.moveInNow) return '즉시 입주';
  if (!v.moveInDate) return '';
  return `${formatDateKorean(v.moveInDate)}${v.moveInNegotiable ? ' · 협의 가능' : ''}`;
}

/** "34평 · 전용 84.98㎡" for a complex area type, "전용 84.98㎡ (25.7평)" for a typed area. */
export function sellAreaText(v: SellFormValues): string {
  const sqm = sellExclusiveSqm(v);
  if (typeof sqm !== 'number') return '';
  return v.areaTypeId && v.areaTypeLabel
    ? `${v.areaTypeLabel} · 전용 ${formatSqm(sqm)}`
    : `전용 ${formatAreaBoth(sqm)}`;
}

/** Aside card "내놓기 요약" (design `.dr-sum`): live recap of what has been entered so far. */
export function SellSummary({
  v,
  step,
  steps,
}: {
  v: SellFormValues;
  step: number;
  steps: number;
}) {
  const price = sellPriceText(v, parseMoney);
  const { done, total } = sellProgress(v);
  const cover = v.photos[0];
  const name = v.complexName || v.buildingName || displayAddress(v.roadAddress);
  const detail = sellAddressDetail(v);
  const rows: [string, string][] = [
    ['면적', sellAreaText(v)],
    ['입주 가능일', sellMoveInText(v)],
    ['사진', v.photos.length > 0 ? `${v.photos.length}장` : '없음'],
    ['연락처', v.contactPhone ? '동의한 중개사에게만 공개' : ''],
    [
      '공개 범위',
      v.visibility === DealRequestVisibility.SELECTED_AGENCIES
        ? `${VISIBILITY_LABEL[v.visibility]} ${v.targetAgencies.length}곳`
        : VISIBILITY_LABEL[v.visibility],
    ],
  ];
  const tip =
    v.photos.length < 3
      ? '사진을 3장 이상 올려 보세요. 주방·욕실 사진이 있으면 중개사가 상태를 미리 알 수 있어요.'
      : done < total
        ? '필수 항목을 모두 채우면 바로 지역 중개사에게 전달할 수 있어요.'
        : '준비가 끝났어요. 마지막 단계에서 내용을 확인하고 요청을 등록해 주세요.';

  return (
    <section className={styles.sum} aria-labelledby="sell-sum-t">
      <div className={styles.sumHd}>
        <h2 id="sell-sum-t" className="t-title">
          내놓기 요약
        </h2>
        <Badge>
          {step + 1} / {steps} 단계
        </Badge>
      </div>
      <div className={styles.sumItem}>
        <span className={styles.sumPh}>
          {cover?.url ? (
            <Image src={cover.url} alt="" fill sizes="76px" unoptimized />
          ) : (
            <PhotoPlaceholder kind={sellPhotoKind(v.assetType)} />
          )}
        </span>
        <div className={styles.sumText}>
          <span className={styles.sumTags}>
            {v.dealType && (
              <DealBadge deal={dealKindOf(v.dealType)}>{DEAL_TYPE_LABEL[v.dealType]}</DealBadge>
            )}
            {v.assetType && <span className="t-cap">{ASSET_TYPE_LABEL[v.assetType]}</span>}
          </span>
          <b className={`${styles.sumName} ${name ? '' : styles.sumEmpty}`}>
            {name || '주소를 입력해 주세요'}
          </b>
          {detail && (
            <span className="t-cap">
              {detail}
              {isComplexAsset(v.assetType) ? ' · 비공개' : ''}
            </span>
          )}
        </div>
      </div>
      <div className={styles.sumPrice}>
        <span className="t-cap">{sellPriceLabel(v.dealType)}</span>
        {price ? (
          <p className={`price ${styles.sumPriceV}`}>{price}</p>
        ) : (
          <p className={styles.sumPriceEmpty}>아직 입력 전이에요</p>
        )}
        {price && v.priceNegotiable && <span className={styles.sumNego}>협의 가능</span>}
      </div>
      <dl className={styles.sumDl}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value ? undefined : styles.muted}>{value || '입력 전'}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.prog}>
        <div className={styles.progTop}>
          <span>필수 항목</span>
          <b className="num">
            {done} / {total}
          </b>
        </div>
        <div
          className={styles.progBar}
          role="progressbar"
          aria-label="필수 항목 입력"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className={styles.tip}>
          <Icon name="image" size={16} />
          <span>{tip}</span>
        </p>
      </div>
    </section>
  );
}
