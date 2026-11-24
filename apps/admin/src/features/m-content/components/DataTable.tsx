'use client';
import { Pagination, Skeleton, Table, cx, type TableProps } from '@house/ui';
import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface DataTableProps<T> extends Omit<TableProps<T>, 'pagination' | 'bare'> {
  /** Card body for one row on phones (≤ 720px) — the table collapses into stacked cards like AdminBanners. */
  card: (row: T, index: number) => ReactNode;
}

/**
 * `Table` from @house/ui on desktop, stacked cards on phones. Lives inside a flush `Panel`.
 * (Generic candidate for promotion to @house/ui — see openIssues of m-content.)
 */
export function DataTable<T>({ card, ...table }: DataTableProps<T>) {
  const { rows, rowKey, loading, loadingRows = 5, empty, caption } = table;
  return (
    <>
      <div className="only-lg">
        <Table bare {...table} />
      </div>
      <ul
        className={cx('only-sm', styles.cards)}
        aria-label={caption}
        aria-busy={loading || undefined}
      >
        {loading ? (
          Array.from({ length: Math.min(loadingRows, 4) }, (_, i) => (
            <li key={i} className={styles.card}>
              <Skeleton height={16} width="72%" />
              <Skeleton height={13} width="48%" />
            </li>
          ))
        ) : rows.length === 0 ? (
          <li className={cx(styles.card, styles.emptyCell)}>{empty}</li>
        ) : (
          rows.map((row, i) => (
            <li key={rowKey(row)} className={styles.card}>
              {card(row, i)}
            </li>
          ))
        )}
      </ul>
    </>
  );
}

export { styles as cardStyles };

/** Panel footer: "19개 중 1–5" + pagination (hidden when everything fits on one page). */
export function ListFooter({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  note,
  unit = '개',
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
  /** Extra text after the range, e.g. "최신순". */
  note?: ReactNode;
  unit?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={styles.footer}>
      <p className={styles.summary}>
        {total.toLocaleString('ko-KR')}
        {unit} 중{' '}
        <b>
          {from}–{to}
        </b>
        {note && <> · {note}</>}
      </p>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={onPage} />}
    </div>
  );
}
