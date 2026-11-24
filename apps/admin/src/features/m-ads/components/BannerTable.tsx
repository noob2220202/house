'use client';
import { BannerStatus, type BannerSlot } from '@house/shared';
import { cx, Icon, Skeleton } from '@house/ui';
import Link from 'next/link';
import { useCallback } from 'react';
import { formatCount, formatPercent } from '@/lib/format';
import { mediaUrl, type AdminBanner, type BannerSlotInfo } from '../api/schemas';
import { useRowDrag } from '../hooks/useRowDrag';
import { formatPeriodShort } from '../lib/dates';
import { slotLabel } from '../lib/slots';
import { ctrOf, displayCode } from '../lib/status';
import { advertiserLine, targetSummary } from '../lib/summary';
import { AdImage } from './AdImage';
import styles from './ads.module.css';
import { StatusToggle } from './StatusToggle';

export interface BannerTableProps {
  rows: readonly AdminBanner[];
  slots: readonly BannerSlotInfo[] | undefined;
  /** Banner open in the editor. */
  editingId: string | null;
  /** Dim the table while a new page is loading. */
  fetching?: boolean;
  /** Ids with a pending toggle. */
  busyIds?: ReadonlySet<string>;
  onEdit: (banner: AdminBanner) => void;
  onDuplicate: (banner: AdminBanner) => void;
  onDelete: (banner: AdminBanner) => void;
  onToggle: (banner: AdminBanner, paused: boolean) => void;
  /** New order of the visible rows of one slot. */
  onReorder: (change: { slot: BannerSlot; ids: string[]; movedId: string; index: number }) => void;
  statsHref: (id: string) => string;
}

const idOf = (b: AdminBanner) => b.id;
const groupOf = (b: AdminBanner) => b.slot;

/** Banner list (design `.bt`): drag handle + order, banner, status toggle, stats, actions. */
export function BannerTable({
  rows,
  slots,
  editingId,
  fetching,
  busyIds,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onReorder,
  statsHref,
}: BannerTableProps) {
  const commit = useCallback(
    (change: { group: string; ids: string[]; movedId: string; index: number }) =>
      onReorder({ ...change, slot: change.group as BannerSlot }),
    [onReorder],
  );
  const { ordered, draggingId, rowRef, handleProps } = useRowDrag({
    rows,
    idOf,
    groupOf,
    onCommit: commit,
  });
  const groupSize = (slot: BannerSlot) => rows.filter((b) => b.slot === slot).length;

  return (
    <div className={cx(styles.tableWrap, fetching && styles.fetching)}>
      <table className={styles.bt}>
        <caption className="sr-only">배너 목록 · 노출 위치와 순서 기준 정렬</caption>
        <colgroup>
          <col style={{ width: 52 }} />
          <col />
          <col style={{ width: 98 }} />
          <col style={{ width: 108 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">순서</th>
            <th scope="col">배너 · 노출 위치 · 기간 · 대상</th>
            <th scope="col">상태</th>
            <th scope="col" className={styles.r}>
              노출 · 클릭 · CTR
            </th>
            <th scope="col" className={styles.r}>
              관리
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((b) => {
            const code = displayCode(b);
            const name = `${code} ${b.title}`;
            const editing = editingId === b.id;
            const image = mediaUrl(b.pcMedia);
            const label = slotLabel(b.slot, slots);
            const notStarted = b.status === BannerStatus.SCHEDULED && b.impressions === 0;
            const sortable = groupSize(b.slot) > 1;
            return (
              <tr
                key={b.id}
                ref={rowRef(b.id)}
                className={cx(
                  editing && styles.editing,
                  draggingId === b.id && styles.dragging,
                  b.status === BannerStatus.ENDED && styles.ended,
                )}
              >
                <td>
                  <button
                    type="button"
                    className={styles.ord}
                    disabled={!sortable}
                    aria-label={`${name} 순서 이동, ${label} ${b.sortOrder}번째. 위아래 화살표 키로 옮길 수 있어요`}
                    title={sortable ? '끌어서 순서 바꾸기' : undefined}
                    {...handleProps(b.id)}
                  >
                    <Icon name="drag" size={18} />
                    <span>{b.sortOrder}</span>
                  </button>
                </td>
                <td>
                  <div className={styles.bn}>
                    <span className={styles.thumb}>
                      {image && <AdImage src={image} alt="" sizes="84px" position="left center" />}
                    </span>
                    <div className={styles.bnT}>
                      <p className={styles.bnTitle}>
                        <b title={b.title}>{b.title}</b>
                        {editing && <span className={styles.editingTag}>수정 중</span>}
                      </p>
                      <p className={styles.bnSub}>
                        <span className={styles.slotTag}>
                          {label} {b.sortOrder}
                        </span>
                        <span className={styles.bnAdv}>{advertiserLine(b)}</span>
                      </p>
                      <p className={styles.bnMeta}>
                        <span>
                          <Icon name="calendar" size={14} />
                          <span className="num">{formatPeriodShort(b.startAt, b.endAt)}</span>
                        </span>
                        <span>
                          <Icon name="map-pin" size={14} />
                          <span>{targetSummary(b)}</span>
                        </span>
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <StatusToggle
                    item={b}
                    name={name}
                    disabled={busyIds?.has(b.id)}
                    onToggle={(paused) => onToggle(b, paused)}
                  />
                </td>
                <td className={styles.r}>
                  <Link
                    href={statsHref(b.id)}
                    className={styles.perfLink}
                    aria-label={
                      notStarted
                        ? `${name} 통계 보기, 게시 전`
                        : `${name} 통계 보기, 노출 ${formatCount(b.impressions)}회, 클릭 ${formatCount(b.clicks)}회`
                    }
                  >
                    {notStarted ? (
                      <>
                        <b className={cx(styles.perf, styles.perfNone)}>–</b>
                        <span className={styles.perfSub}>게시 전</span>
                      </>
                    ) : (
                      <>
                        <b className={styles.perf}>{formatCount(b.impressions)}</b>
                        <span className={styles.perfSub}>
                          {formatCount(b.clicks)} · {formatPercent(ctrOf(b.impressions, b.clicks))}
                        </span>
                      </>
                    )}
                  </Link>
                </td>
                <td className={styles.r}>
                  <span className={styles.acts}>
                    <button
                      type="button"
                      id={`ads-edit-${b.id}`}
                      className={cx(styles.act, editing && styles.actOn)}
                      aria-label={`${name} 수정`}
                      aria-pressed={editing}
                      onClick={() => onEdit(b)}
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.act}
                      aria-label={`${name} 복제`}
                      onClick={() => onDuplicate(b)}
                    >
                      <Icon name="copy" size={18} />
                    </button>
                    <button
                      type="button"
                      className={cx(styles.act, styles.actDel)}
                      aria-label={`${name} 삭제`}
                      onClick={() => onDelete(b)}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton rows with the footprint of the table. */
export function BannerTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="목록 불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skRow} aria-hidden="true">
          <Skeleton width={30} height={16} />
          <Skeleton width={84} height={38} radius={7} />
          <span className={styles.skGrow}>
            <Skeleton width="46%" height={14} />
            <Skeleton width="62%" height={12} />
            <Skeleton width="38%" height={12} />
          </span>
          <Skeleton width={64} height={26} radius={13} />
          <Skeleton width={56} height={30} />
        </div>
      ))}
    </div>
  );
}
