import styles from './Pagination.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';
import { Icon } from '../icons/Icon';

export interface PaginationProps {
  /** Current page (1-based). */
  page: number;
  totalPages: number;
  /** Button mode: called with the new page. */
  onChange?: (page: number) => void;
  /** Link mode (SEO-friendly): build the href for a page. */
  hrefFor?: (page: number) => string;
  linkAs?: LinkAs;
  /** Pages shown on each side of the current one. */
  siblings?: number;
  className?: string;
}

/** Returns the page list with `null` for gaps: [1, null, 4, 5, 6, null, 20]. */
export function paginationRange(page: number, totalPages: number, siblings = 1): (number | null)[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), total);
  const out: (number | null)[] = [];
  const start = Math.max(2, current - siblings);
  const end = Math.min(total - 1, current + siblings);
  out.push(1);
  if (start > 2) out.push(null);
  for (let p = start; p <= end; p += 1) out.push(p);
  if (end < total - 1) out.push(null);
  if (total > 1) out.push(total);
  return out;
}

/** Numbered pagination — pass `onChange` (buttons) or `hrefFor` (links). */
export function Pagination({
  page,
  totalPages,
  onChange,
  hrefFor,
  linkAs,
  siblings = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const Link = linkAs ?? 'a';
  const item = (
    p: number,
    content: React.ReactNode,
    opts: { label: string; current?: boolean; disabled?: boolean; nav?: boolean },
  ) => {
    const cls = cx(styles.item, opts.current && styles.on, opts.nav && styles.nav);
    if (opts.disabled) {
      return (
        <span className={cx(cls, styles.disabled)} aria-disabled="true" aria-label={opts.label}>
          {content}
        </span>
      );
    }
    if (hrefFor) {
      const props = {
        href: hrefFor(p),
        className: cls,
        'aria-label': opts.label,
        'aria-current': opts.current ? ('page' as const) : undefined,
      };
      return <Link {...props}>{content}</Link>;
    }
    return (
      <button
        type="button"
        className={cls}
        aria-label={opts.label}
        aria-current={opts.current ? 'page' : undefined}
        onClick={() => onChange?.(p)}
      >
        {content}
      </button>
    );
  };
  return (
    <nav aria-label="페이지" className={cx(styles.root, className)}>
      <ul className={styles.list}>
        <li>
          {item(page - 1, <Icon name="chevron-left" size={18} />, {
            label: '이전 페이지',
            disabled: page <= 1,
            nav: true,
          })}
        </li>
        {paginationRange(page, totalPages, siblings).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} className={styles.gap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>{item(p, p, { label: `${p} 페이지`, current: p === page })}</li>
          ),
        )}
        <li>
          {item(page + 1, <Icon name="chevron-right" size={18} />, {
            label: '다음 페이지',
            disabled: page >= totalPages,
            nav: true,
          })}
        </li>
      </ul>
    </nav>
  );
}
