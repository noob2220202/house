import { Icon, StatusPill, cx } from '@house/ui';
import Link from 'next/link';
import { formatDday, formatRelativeTime } from '@/lib/format';
import type { AgencyDealRequest } from '../api/schemas';
import { requestHeadlinePrice, requestSubtitle, requestTitle } from '../lib/request-text';
import { inboxStage, isRequestActive, stagePill } from '../lib/stage';
import { INBOX_ROUTES } from '../routes';
import ui from '../ui/inbox.module.css';
import { TargetedChip, TypeChip } from '../ui/TypeChip';
import styles from './Requests.module.css';

/** "D-3" style deadline; hot when three days or fewer are left. */
export function deadlineOf(
  r: Pick<AgencyDealRequest, 'status' | 'expiresAt'>,
  now?: Date,
): { label: string; hot: boolean } | null {
  if (!r.expiresAt || !isRequestActive(r.status)) return null;
  const label = formatDday(r.expiresAt, now);
  const days = Number(label.replace('D-', ''));
  return { label, hot: label === 'D-DAY' || (Number.isFinite(days) && days <= 3) };
}

export interface RequestRowProps {
  request: AgencyDealRequest;
  /** Injected clock for stable relative times in tests. */
  now?: Date;
}

/** One request in the inbox list — the whole row is a link to the detail page. */
export function RequestRow({ request: r, now }: RequestRowProps) {
  const pill = stagePill(r);
  const stage = inboxStage(r);
  const price = requestHeadlinePrice(r);
  const deadline = deadlineOf(r, now);
  const others = r.proposalCount - (r.myProposal ? 1 : 0);
  return (
    <li>
      <Link
        href={INBOX_ROUTES.request(r.id)}
        className={cx(
          styles.row,
          stage === 'NEW' && styles.rowNew,
          stage === 'ENDED' && styles.rowEnded,
        )}
      >
        <span className={styles.rowMain}>
          <span className={styles.rowHead}>
            <TypeChip type={r.type} />
            {r.targeted && <TargetedChip />}
            <span className={styles.rowTitle}>{requestTitle(r)}</span>
          </span>
          <span className={styles.rowSub}>{requestSubtitle(r)}</span>
          <span className={ui.meta}>
            <time dateTime={r.createdAt}>{formatRelativeTime(r.createdAt, now)}</time>
            {deadline && (
              <span className={deadline.hot ? ui.hot : undefined}>마감 {deadline.label}</span>
            )}
            <span>
              {others > 0 ? (
                <>
                  다른 사무소 제안 <b>{others}</b>곳
                </>
              ) : (
                '아직 다른 제안 없음'
              )}
            </span>
          </span>
        </span>
        <span className={styles.rowPrice}>
          {price ? (
            <>
              <span className={styles.rowPriceLabel}>{price.label}</span>
              <span className={styles.rowPriceValue}>{price.value}</span>
            </>
          ) : (
            <span className={styles.rowPriceLabel}>금액 협의</span>
          )}
        </span>
        <span className={styles.rowPill}>
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
        </span>
        {/* Wrapper: <Icon> sets an inline display, so the mobile "hide" has to sit on a parent. */}
        <span className={styles.rowChev} aria-hidden="true">
          <Icon name="chevron-right" size={18} />
        </span>
      </Link>
    </li>
  );
}
