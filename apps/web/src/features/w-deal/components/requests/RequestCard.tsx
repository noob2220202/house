import { DEAL_TYPE_LABEL, DealRequestType } from '@house/shared';
import {
  cx,
  DealBadge,
  Icon,
  PhotoPlaceholder,
  Skeleton,
  StatusPill,
  dealKindOf,
  photoKindForAsset,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatDateShort, formatDday } from '@/lib/format';
import type { DealRequest } from '../../api/schemas';
import { isRequestActive, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from '../../lib/labels';
import { requestPriceLines, requestSubtitle, requestTitle } from '../../lib/summary';
import styles from './requests.module.css';

export function RequestKindTag({ type }: { type: DealRequestType }) {
  const sell = type === DealRequestType.SELL_OR_LEASE;
  return (
    <span className={cx(styles.kind, !sell && styles.kindFind)}>
      <Icon name={sell ? 'home-up' : 'home-search'} size={14} />
      {sell ? '내놓기' : '구하기'}
    </span>
  );
}

/** One row of 내 요청 관리: what was requested, its status and how many proposals arrived. */
export function RequestCard({ request, now }: { request: DealRequest; now: string }) {
  const active = isRequestActive(request.status);
  const cover = request.photos[0]?.variants.thumb?.url;
  const prices = requestPriceLines(request);
  const sub = requestSubtitle(request);
  return (
    <li className={cx(styles.card, !active && styles.ended)}>
      <span className={styles.ph}>
        {cover ? (
          <Image src={cover} alt="" fill sizes="76px" unoptimized />
        ) : (
          <PhotoPlaceholder kind={photoKindForAsset(request.assetType)} />
        )}
      </span>
      <div className={styles.body}>
        <div className={styles.tags}>
          <RequestKindTag type={request.type} />
          {request.dealTypes.map((d) => (
            <DealBadge key={d} deal={dealKindOf(d)}>
              {DEAL_TYPE_LABEL[d]}
            </DealBadge>
          ))}
          <StatusPill tone={REQUEST_STATUS_TONE[request.status]}>
            {REQUEST_STATUS_LABEL[request.status]}
          </StatusPill>
        </div>
        <h2 className={styles.name}>
          <Link href={`${ROUTES.myRequests}/${request.id}`}>{requestTitle(request)}</Link>
        </h2>
        {sub && <p className={styles.sub}>{sub}</p>}
        {prices.length > 0 && (
          <p className={styles.priceRow}>
            {prices.map((p) => (
              <span key={p.label}>
                {p.label}
                <b>{p.value}</b>
              </span>
            ))}
          </p>
        )}
      </div>
      <div className={styles.side}>
        <p className={cx(styles.count, active && request.proposalCount > 0 && styles.hot)}>
          제안 <b>{request.proposalCount}</b>건
        </p>
        {active && request.pendingProposalCount > 0 && (
          <span className={styles.newBadge}>답변 대기 {request.pendingProposalCount}</span>
        )}
        <span className={styles.meta}>
          {formatDateShort(request.createdAt)} 등록
          {active && request.expiresAt ? ` · ${formatDday(request.expiresAt, now)}` : ''}
        </span>
      </div>
    </li>
  );
}

export function RequestListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.list} role="status" aria-busy="true" aria-label="요청을 불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skCard} aria-hidden="true">
          <Skeleton width={76} height={76} radius={12} />
          <div className={styles.skLines}>
            <Skeleton width={160} height={22} />
            <Skeleton width="55%" height={22} />
            <Skeleton width="35%" height={16} />
          </div>
        </div>
      ))}
    </div>
  );
}
