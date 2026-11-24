'use client';
import { ListingStatus, PUBLIC_LISTING_STATUSES } from '@house/shared';
import { Icon, IconButton, Popover, cx, type IconName } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { AgencyListingItem } from '../api/schemas';
import { rowTitle } from '../lib/display';
import { STATUS_ACTION_LABEL, allowedTransitions } from '../lib/status';
import { editStepHref } from '../routes';
import styles from './list.module.css';

export type RowAction =
  | { type: 'verify' }
  | { type: 'status'; to: ListingStatus }
  | { type: 'delete' }
  | { type: 'leave' };

const STATUS_ICON: Record<ListingStatus, IconName> = {
  ACTIVE: 'megaphone',
  RESERVED: 'document',
  CLOSED: 'check-circle',
  HIDDEN: 'eye',
  DRAFT: 'edit',
};

export interface RowMenuProps {
  row: AgencyListingItem;
  /** AGENCY_OWNER — only the owner joins / leaves co-brokerage. */
  isOwner: boolean;
  onAction: (action: RowAction) => void;
}

/** "⋯" menu of a listing row: public page, 실매물 확인, status transitions, delete / leave. */
export function RowMenu({ row, isOwner, onAction }: RowMenuProps) {
  const isPublic = PUBLIC_LISTING_STATUSES.includes(row.status);
  const transitions = allowedTransitions(row.status, {
    isPrimary: row.isPrimary,
    hiddenByOperator: !!row.hiddenReason,
  });
  const canVerify = row.status !== ListingStatus.CLOSED;

  return (
    <Popover
      placement="bottom-end"
      label={`${rowTitle(row)} 더보기`}
      flush
      trigger={(props) => (
        <IconButton {...props} label={`${rowTitle(row)} 더보기 메뉴`} size={36} variant="plain">
          <Icon name="more" size={20} />
        </IconButton>
      )}
    >
      {(close) => {
        const run = (action: RowAction) => {
          close();
          onAction(action);
        };
        return (
          <div className={styles.menu}>
            {row.status === ListingStatus.DRAFT && row.isPrimary && (
              <Link href={editStepHref(row.id, 'preview')} onClick={close}>
                <Icon name="megaphone" size={18} />
                미리보기·게시
              </Link>
            )}
            {isPublic && (
              <a href={ROUTES.listing(row.id)} target="_blank" rel="noreferrer" onClick={close}>
                <Icon name="external-link" size={18} />
                공개 페이지 보기
              </a>
            )}
            {canVerify && (
              <button type="button" onClick={() => run({ type: 'verify' })}>
                <Icon name="shield" size={18} />
                실매물 확인 기록
              </button>
            )}
            {row.isPrimary && row.status !== ListingStatus.CLOSED && (
              <Link href={editStepHref(row.id, 'photos')} onClick={close}>
                <Icon name="image" size={18} />
                사진 관리
              </Link>
            )}
            {transitions.length > 0 && <hr />}
            {transitions.map((to) => (
              <button key={to} type="button" onClick={() => run({ type: 'status', to })}>
                <Icon name={STATUS_ICON[to]} size={18} />
                {STATUS_ACTION_LABEL[to]}
              </button>
            ))}
            {row.status === ListingStatus.HIDDEN && row.hiddenReason && (
              <p className={styles.menuNote}>운영팀이 숨긴 매물이에요. {row.hiddenReason}</p>
            )}
            <hr />
            {row.isPrimary ? (
              <button
                type="button"
                className={styles.danger}
                onClick={() => run({ type: 'delete' })}
              >
                <Icon name="trash" size={18} />
                {row.status === ListingStatus.DRAFT ? '작성중인 매물 삭제' : '매물 삭제'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={cx(isOwner && styles.danger)}
                  disabled={!isOwner}
                  onClick={() => run({ type: 'leave' })}
                >
                  <Icon name="logout" size={18} />
                  공동중개 나가기
                </button>
                {!isOwner && (
                  <p className={styles.menuNote}>공동중개 참여·탈퇴는 대표만 할 수 있어요.</p>
                )}
              </>
            )}
          </div>
        );
      }}
    </Popover>
  );
}
