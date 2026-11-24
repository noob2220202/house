import { Badge, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatCount, formatDate } from '@/lib/format';
import type { NoticeSummary } from '../api/schemas';
import styles from './notices.module.css';

const NEW_WINDOW_MS = 7 * 86_400_000;

export const noticeHref = (id: string) => `${ROUTES.notices}/${encodeURIComponent(id)}`;

export interface NoticeListProps {
  items: readonly NoticeSummary[];
  /** Reference time for the NEW badge (ISO) — passed in so server and client agree. */
  now: string;
}

/** 공지사항 rows: [중요] title · date · views. Pinned rows get a soft brand tint. */
export function NoticeList({ items, now }: NoticeListProps) {
  const nowMs = Date.parse(now);
  return (
    <ul className={styles.list}>
      {items.map((n) => {
        const published = n.publishedAt ? Date.parse(n.publishedAt) : NaN;
        const isNew = Number.isFinite(published) && nowMs - published < NEW_WINDOW_MS;
        return (
          <li key={n.id}>
            <Link
              href={noticeHref(n.id)}
              className={styles.row}
              data-pinned={n.isPinned || undefined}
            >
              <span className={styles.lead}>
                {n.isPinned ? (
                  <Badge tone="brand">중요</Badge>
                ) : (
                  <span className={styles.kind}>공지</span>
                )}
              </span>
              <span className={styles.title}>
                <span className={styles.titleText}>{n.title}</span>
                {isNew && (
                  <span className={styles.new} aria-label="새 글">
                    N
                  </span>
                )}
              </span>
              <span className={styles.meta}>
                {n.publishedAt && (
                  <time dateTime={n.publishedAt} className="num">
                    {formatDate(n.publishedAt)}
                  </time>
                )}
                {typeof n.viewCount === 'number' && (
                  <span className={styles.views}>
                    <Icon name="eye" size={14} />
                    <span className="sr-only">조회수</span>
                    <span className="num">{formatCount(n.viewCount)}</span>
                  </span>
                )}
              </span>
              <Icon name="chevron-right" size={18} className={styles.chev} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
