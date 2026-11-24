'use client';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import styles from './Table.module.css';
import { cx } from '../lib/cx';
import type { DealKind } from '../lib/types';
import { Icon } from '../icons/Icon';
import { Pagination, type PaginationProps } from './Pagination';
import { Skeleton } from './Skeleton';

export type SortDir = 'asc' | 'desc';
export interface TableSort {
  key: string;
  dir: SortDir;
}

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  width?: number | string;
  /** Colours the header with a deal-type colour (분양/매매/전세/월세 columns). */
  dealTone?: DealKind;
  /** Accessible header text when `header` is not plain text. */
  headerLabel?: string;
}

export interface TableProps<T> {
  /** Visually hidden caption describing the table. */
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  /** Adds a checkbox column. */
  selectable?: boolean;
  selectedKeys?: readonly string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Sticky header inside a scroll area of this max height. */
  stickyHeader?: boolean;
  maxHeight?: number | string;
  /** Row height: default 60, compact 48. */
  density?: 'default' | 'compact';
  /** Shows skeleton rows. */
  loading?: boolean;
  loadingRows?: number;
  /** Rendered when there are no rows (e.g. <EmptyState compact … />). */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Renders a pagination footer. */
  pagination?: PaginationProps;
  /** Remove the outer border/radius (inside a Panel). */
  bare?: boolean;
  className?: string;
}

/** Data table: sortable headers (aria-sort), row selection, sticky header, pagination footer. */
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  selectable,
  selectedKeys = [],
  onSelectionChange,
  stickyHeader,
  maxHeight,
  density = 'default',
  loading,
  loadingRows = 5,
  empty,
  onRowClick,
  pagination,
  bare,
  className,
}: TableProps<T>) {
  const keys = rows.map(rowKey);
  const selected = new Set(selectedKeys);
  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
  const someSelected = keys.some((k) => selected.has(k));
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const toggleAll = () => {
    if (allSelected) onSelectionChange?.(selectedKeys.filter((k) => !keys.includes(k)));
    else onSelectionChange?.(Array.from(new Set([...selectedKeys, ...keys])));
  };
  const toggleRow = (key: string) =>
    onSelectionChange?.(
      selected.has(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key],
    );
  const colCount = columns.length + (selectable ? 1 : 0);
  const scrollStyle: CSSProperties | undefined = stickyHeader
    ? { maxHeight: maxHeight ?? 480, overflowY: 'auto' }
    : undefined;

  return (
    <div className={cx(styles.wrap, bare && styles.bare, className)}>
      <div className={styles.scroll} style={scrollStyle}>
        <table
          className={cx(
            styles.table,
            density === 'compact' && styles.compact,
            stickyHeader && styles.sticky,
          )}
          aria-busy={loading || undefined}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className={styles.checkCol}>
                  <input
                    ref={allRef}
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="현재 페이지 전체 선택"
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const ariaSort = c.sortable
                  ? active
                    ? sort?.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                  : undefined;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={ariaSort}
                    aria-label={c.sortable ? undefined : c.headerLabel}
                    className={cx(c.align && styles[c.align], c.dealTone && styles[c.dealTone])}
                    style={{ width: c.width }}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        className={cx(styles.sortBtn, active && styles.sortOn)}
                        onClick={() =>
                          onSortChange?.({
                            key: c.key,
                            dir: active && sort?.dir === 'asc' ? 'desc' : 'asc',
                          })
                        }
                      >
                        {c.header}
                        <Icon
                          name={active ? (sort?.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'}
                          size={14}
                        />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: loadingRows }, (_, r) => (
                  <tr key={`sk-${r}`}>
                    {Array.from({ length: colCount }, (_, c) => (
                      <td key={c}>
                        <Skeleton height={14} width={c === 0 && selectable ? 18 : '70%'} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, i) => {
                  const key = rowKey(row);
                  const isSelected = selected.has(key);
                  return (
                    <tr
                      key={key}
                      className={cx(isSelected && styles.selected, onRowClick && styles.clickable)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <td className={styles.checkCol} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={isSelected}
                            onChange={() => toggleRow(key)}
                            aria-label={`${i + 1}번째 행 선택`}
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={c.align ? styles[c.align] : undefined}>
                          {c.cell(row, i)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            {!loading && rows.length === 0 && (
              <tr className={styles.emptyRow}>
                <td colSpan={colCount}>
                  {empty ?? <span className={styles.emptyText}>표시할 항목이 없어요</span>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className={styles.foot}>
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}
