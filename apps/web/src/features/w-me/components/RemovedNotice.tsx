'use client';
import { Icon, IconButton, cx } from '@house/ui';
import type { Ref } from 'react';
import type { RemovedFavorite } from '../hooks/useFavoriteRemoval';
import styles from './RemovedNotice.module.css';

export interface RemovedNoticeProps {
  items: readonly RemovedFavorite[];
  /** Noun with its object particle: "매물을" / "단지를". */
  objectPhrase: string;
  onRestore: (item: RemovedFavorite) => void;
  onDismiss: (item: RemovedFavorite) => void;
  /** Ref of the newest "되돌리기" button (focus target when the list becomes empty). */
  restoreRef?: Ref<HTMLButtonElement>;
  className?: string;
}

/**
 * Inline, persistent way back for favourites that were just removed. It sits right above the list
 * (so a keyboard user reaches it without leaving the page region) and stays until dismissed or the
 * page is left — unlike the undo toast it does not time out.
 */
export function RemovedNotice({
  items,
  objectPhrase,
  onRestore,
  onDismiss,
  restoreRef,
  className,
}: RemovedNoticeProps) {
  if (items.length === 0) return null;
  return (
    <ul className={cx(styles.list, className)} aria-label="방금 관심 목록에서 뺀 항목">
      {items.map((item, i) => (
        <li key={item.id} className={styles.row}>
          <Icon name="info" size={18} className={styles.icon} />
          <span className={styles.text}>
            <b>{item.name}</b> {objectPhrase} 관심 목록에서 뺐어요.
          </span>
          <button
            ref={i === 0 ? restoreRef : undefined}
            type="button"
            className={styles.undo}
            aria-busy={item.restoring || undefined}
            onClick={() => onRestore(item)}
          >
            {item.restoring ? '되돌리는 중' : '되돌리기'}
            <span className="sr-only">: {item.name}</span>
          </button>
          <IconButton
            variant="plain"
            size={36}
            label={`${item.name} 삭제 안내 닫기`}
            onClick={() => onDismiss(item)}
          >
            <Icon name="close" size={16} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
