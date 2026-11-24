import { ASSET_TYPE_LABEL, DEAL_TYPE_LABEL, DealRequestType } from '@house/shared';
import { Badge, Callout, DealBadge, Tag, dealKindOf } from '@house/ui';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { formatDate, formatDateKorean, formatDday } from '@/lib/format';
import type { AgencyDealRequestDetail } from '../api/schemas';
import {
  VISIBILITY_TEXT,
  requestAreaText,
  requestPriceLines,
  splitFlags,
  wantedPlaces,
} from '../lib/request-text';
import { isRequestActive } from '../lib/stage';
import styles from './Requests.module.css';

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? `${styles.fact} ${styles.factWide}` : styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export interface RequestSummaryProps {
  request: AgencyDealRequestDetail;
  now?: Date;
}

/** What the requester asked for: prices, conditions, their own words and photos. No private data. */
export function RequestSummary({ request: r, now }: RequestSummaryProps) {
  const sell = r.type === DealRequestType.SELL_OR_LEASE;
  const prices = requestPriceLines(r);
  const { flags, text } = splitFlags(r.description);
  const area = requestAreaText(r);
  const places = wantedPlaces(r);
  const photos = r.photos
    .map((p) => ({
      id: p.id,
      url: p.variants.thumb?.url ?? p.variants.medium?.url,
      full: p.variants.large?.url ?? p.variants.medium?.url ?? p.variants.thumb?.url,
    }))
    .filter((p): p is { id: string; url: string; full: string } => !!p.url && !!p.full);

  return (
    <div>
      {prices.length > 0 && (
        <div className={styles.prices}>
          {prices.map((p) => (
            <p key={p.label} className={styles.priceItem}>
              <span>{p.label}</span>
              <b>{p.value}</b>
            </p>
          ))}
        </div>
      )}

      <dl className={styles.facts}>
        <Fact label="매물 종류">{ASSET_TYPE_LABEL[r.assetType]}</Fact>
        <Fact label="거래 유형">
          <span className={styles.places}>
            {r.dealTypes.map((d) => (
              <DealBadge key={d} deal={dealKindOf(d)}>
                {DEAL_TYPE_LABEL[d]}
              </DealBadge>
            ))}
          </span>
        </Fact>
        {sell ? (
          <Fact label="위치">
            {r.complexName ?? r.emdName ?? '순천시'}
            {r.complexName && r.emdName && <small className={styles.factSub}>{r.emdName}</small>}
          </Fact>
        ) : (
          <Fact label="희망 지역" wide={places.length > 2}>
            {places.length > 0 ? (
              <span className={styles.places}>
                {places.map((p) => (
                  <Tag key={p}>{p}</Tag>
                ))}
              </span>
            ) : (
              '순천시 전체'
            )}
          </Fact>
        )}
        {area && <Fact label={sell ? '전용면적' : '희망 면적'}>{area.replace(/^전용 /, '')}</Fact>}
        {sell && typeof r.floor === 'number' && <Fact label="층">{r.floor}층</Fact>}
        {!sell && typeof r.roomsMin === 'number' && <Fact label="방 수">{r.roomsMin}개 이상</Fact>}
        {r.moveInDate && (
          <Fact label={sell ? '입주 가능일' : '입주 희망일'}>{formatDateKorean(r.moveInDate)}</Fact>
        )}
        <Fact label="전달 범위">{VISIBILITY_TEXT[r.visibility]}</Fact>
        {r.expiresAt && (
          <Fact label="요청 마감">
            {formatDate(r.expiresAt)}
            {isRequestActive(r.status) && <small> · {formatDday(r.expiresAt, now)}</small>}
          </Fact>
        )}
      </dl>

      {(flags.length > 0 || text) && (
        <div className={styles.says}>
          <h3 className={styles.saysTitle}>요청자가 남긴 말</h3>
          {flags.length > 0 && (
            <div className={styles.flags}>
              {flags.map((f) => (
                <Badge key={f} tone="accent">
                  {f}
                </Badge>
              ))}
            </div>
          )}
          {text && <p className={styles.saysText}>{text}</p>}
        </div>
      )}

      {photos.length > 0 && (
        <div className={styles.says}>
          <h3 className={styles.saysTitle}>첨부 사진 {photos.length}장</h3>
          <ul className={styles.photos}>
            {photos.map((p, i) => (
              <li key={p.id}>
                {/* Thumbnails are small: the full photo opens in a new tab. */}
                <a className={styles.photo} href={p.full} target="_blank" rel="noopener noreferrer">
                  <Image
                    src={p.url}
                    alt={`요청자가 올린 사진 ${i + 1} 크게 보기`}
                    fill
                    sizes="120px"
                  />
                  <span className="sr-only"> (새 창에서 열기)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sell && !r.contact && isRequestActive(r.status) && (
        <Callout size="sm" icon="lock" tone="muted" className={styles.privacy}>
          도로명 주소와 동·호수는 요청자가 연락처를 공개하면 함께 볼 수 있어요.
        </Callout>
      )}
    </div>
  );
}
