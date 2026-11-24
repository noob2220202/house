'use client';
import { Button, Modal } from '@house/ui';
import { formatCount, formatPriceRange, formatRelativeTime } from '@/lib/format';
import type { Proposal } from '../../api/schemas';
import { ProposalStatusBadge } from './ProposalCard';
import styles from './requests.module.css';

/** Price range of the listings attached to a proposal ("4억 4,500 ~ 4억 6,000"), '' when none. */
export function listingsPriceRange(p: Proposal): string {
  const prices = p.listings
    .map((l) => l.price ?? l.deposit)
    .filter((n): n is number => typeof n === 'number');
  if (prices.length === 0) return '';
  return formatPriceRange(Math.min(...prices), Math.max(...prices));
}

/** Index of the fastest-responding agency among the compared proposals (-1 when unknown). */
export function fastestIndex(proposals: readonly Proposal[]): number {
  let best = -1;
  proposals.forEach((p, i) => {
    const m = p.agency.avgResponseMinutes;
    if (typeof m !== 'number') return;
    const cur = best >= 0 ? proposals[best]?.agency.avgResponseMinutes : undefined;
    if (typeof cur !== 'number' || m < cur) best = i;
  });
  return best;
}

export interface CompareDialogProps {
  open: boolean;
  onClose: () => void;
  proposals: readonly Proposal[];
  now: string;
  busy?: boolean;
  onAccept: (proposal: Proposal) => void;
  onDecline: (proposal: Proposal) => void;
}

/** Side-by-side comparison of the selected proposals (scrolls horizontally on small screens). */
export function CompareDialog({
  open,
  onClose,
  proposals,
  now,
  busy,
  onAccept,
  onDecline,
}: CompareDialogProps) {
  const fastest = fastestIndex(proposals);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="제안 비교"
      description={`${proposals.length}곳의 제안을 나란히 비교해 보세요.`}
    >
      <div className={styles.cmpWrap} tabIndex={0} role="region" aria-label="제안 비교 표">
        <table className={styles.cmp}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">항목</span>
              </th>
              {proposals.map((p) => (
                <th key={p.id} scope="col">
                  {p.agency.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">상태</th>
              {proposals.map((p) => (
                <td key={p.id}>
                  <ProposalStatusBadge status={p.status} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">전문 분야</th>
              {proposals.map((p) => (
                <td key={p.id}>{p.agency.specialty ?? '-'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">평균 응답</th>
              {proposals.map((p, i) => (
                <td key={p.id} className={i === fastest ? styles.best : undefined}>
                  {typeof p.agency.avgResponseMinutes === 'number'
                    ? `${p.agency.avgResponseMinutes}분${i === fastest && proposals.length > 1 ? ' · 가장 빠름' : ''}`
                    : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">보유 매물</th>
              {proposals.map((p) => (
                <td key={p.id}>
                  {typeof p.agency.activeListingCount === 'number'
                    ? `${formatCount(p.agency.activeListingCount)}건`
                    : '-'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">제안 도착</th>
              {proposals.map((p) => (
                <td key={p.id}>{formatRelativeTime(p.createdAt, now)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">추천 매물</th>
              {proposals.map((p) => (
                <td key={p.id}>
                  {p.listings.length > 0 ? (
                    <>
                      <b>{p.listings.length}건</b>
                      <br />
                      <span className="num">{listingsPriceRange(p)}</span>
                    </>
                  ) : (
                    '없음'
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">제안 내용</th>
              {proposals.map((p) => (
                <td key={p.id}>
                  <span className={styles.cmpMsg}>{p.message}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">연락처</th>
              {proposals.map((p) => (
                <td key={p.id}>{p.contactGranted ? '공개 중' : '비공개'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">선택</th>
              {proposals.map((p) => (
                <td key={p.id}>
                  <div className={styles.cmpActions}>
                    <Button type="button" size="sm" disabled={busy} onClick={() => onAccept(p)}>
                      수락
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => onDecline(p)}
                    >
                      거절
                    </Button>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
