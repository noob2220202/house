'use client';
import { ProposalStatus } from '@house/shared';
import { Button, Callout, ConfirmDialog, Icon, cx } from '@house/ui';
import Link from 'next/link';
import { useState } from 'react';
import { ROUTES } from '@/config/nav';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import type { AgencyDealRequestDetail } from '../api/schemas';
import { splitProposalMessage } from '../lib/proposal';
import { canWithdraw, proposalTimeline } from '../lib/stage';
import { ListingMini } from '../ui/ListingMini';
import styles from './Requests.module.css';

export interface MyProposalCardProps {
  request: AgencyDealRequestDetail;
  withdrawing?: boolean;
  onWithdraw: () => void;
  now?: Date;
}

/** The proposal this office sent: progress, message, attached listings and 철회. */
export function MyProposalCard({ request: r, withdrawing, onWithdraw, now }: MyProposalCardProps) {
  const [confirm, setConfirm] = useState(false);
  const p = r.myProposal;
  if (!p) return null;
  const { offers, text } = splitProposalMessage(p.message);
  const steps = proposalTimeline(r, r.contact?.grantedAt);
  const others = r.proposalCount - 1;

  return (
    <div className={styles.proposal}>
      {p.status === ProposalStatus.ACCEPTED && (
        <Callout size="sm" icon="check-circle" tone="success" title="요청자가 제안을 수락했어요">
          {r.contactGranted
            ? '공개된 연락처로 방문 일정과 다음 절차를 안내해 주세요.'
            : '요청자가 연락처를 공개하면 바로 연락할 수 있어요.'}
        </Callout>
      )}
      {p.status === ProposalStatus.DECLINED && (
        <Callout size="sm" icon="info" tone="muted" title="요청자가 이 제안을 거절했어요">
          같은 요청에는 다시 제안할 수 없어요. 다른 새 요청을 확인해 보세요.
        </Callout>
      )}
      {p.status === ProposalStatus.WITHDRAWN && (
        <Callout size="sm" icon="info" tone="muted" title="우리 사무소가 철회한 제안이에요">
          철회한 요청에는 다시 제안할 수 없어요.
        </Callout>
      )}

      <ol className={styles.timeline} aria-label="제안 진행 상황">
        {steps.map((s) => (
          <li
            key={s.key}
            className={cx(
              styles.step,
              s.state === 'done' && styles.stepDone,
              s.state === 'off' && styles.stepOff,
            )}
          >
            <span className={styles.stepDot} aria-hidden="true">
              {s.state === 'done' && <Icon name="check" size={12} />}
              {s.state === 'off' && <Icon name="close" size={12} />}
            </span>
            <span className={styles.stepLabel}>
              {s.label}
              {s.state === 'pending' && <span className="sr-only"> (대기 중)</span>}
            </span>
            {s.at ? (
              <time className={styles.stepTime} dateTime={s.at} title={formatDateTime(s.at)}>
                {formatRelativeTime(s.at, now)}
              </time>
            ) : (
              <span className={styles.stepTime}>{s.state === 'pending' ? '대기 중' : ''}</span>
            )}
          </li>
        ))}
      </ol>

      {offers.length > 0 && (
        <div className={styles.offers}>
          {offers.map((o) => (
            <span key={o} className={styles.offer}>
              <Icon name="calc" size={16} />
              {o}
            </span>
          ))}
        </div>
      )}
      <div>
        <p className={styles.message}>{text}</p>
        <p className={styles.byline}>
          {[p.memberName ? `작성 ${p.memberName}` : null, formatDateTime(p.createdAt)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {p.listings.length > 0 && (
        <div className={styles.attached}>
          <h3 className={styles.attachedTitle}>첨부한 매물 {p.listings.length}건</h3>
          <ul className={styles.attachedList}>
            {p.listings.map((l) => (
              <li key={l.id}>
                <Link
                  href={ROUTES.listing(l.id)}
                  className={styles.attachedItem}
                  target="_blank"
                  rel="noopener"
                >
                  <ListingMini listing={l} />
                  <span className="sr-only"> (새 창에서 열기)</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.proposalFoot}>
        <span>
          {others > 0 ? `다른 사무소 ${others}곳도 제안했어요` : '아직 우리 사무소만 제안했어요'}
        </span>
        {canWithdraw(r) && (
          <Button variant="ghost" size="sm" loading={withdrawing} onClick={() => setConfirm(true)}>
            제안 철회
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onWithdraw();
        }}
        title="제안을 철회할까요?"
        description="철회하면 요청자에게 더 이상 보이지 않고, 같은 요청에는 다시 제안할 수 없어요."
        confirmLabel="철회하기"
        cancelLabel="그대로 두기"
        danger
      />
    </div>
  );
}
