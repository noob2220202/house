import { Breadcrumb, StatTile, type BreadcrumbItem } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import styles from './seo.module.css';

/** Breadcrumb · eyebrow · H1 · lead paragraphs (server-rendered — the facts crawlers read). */
export function SeoHead({
  crumbs,
  eyebrow,
  title,
  lead,
  stamp,
  actions,
}: {
  /** Trail after 홈; the last item is the current page. */
  crumbs: readonly BreadcrumbItem[];
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: readonly string[];
  stamp?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.head}>
      <Breadcrumb
        linkAs={Link}
        items={[{ label: '홈', href: ROUTES.home }, ...crumbs]}
        className={styles.crumb}
      />
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="t-h1">{title}</h1>
      {lead?.map((p) => (
        <p key={p} className={styles.lead}>
          {p}
        </p>
      ))}
      {stamp && <p className={styles.stamp}>{stamp}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export interface Kpi {
  label: string;
  value: string;
  unit?: string;
  detail?: ReactNode;
}

export function KpiRow({ items, label }: { items: readonly Kpi[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.kpis} aria-label={label}>
      {items.map((k) => (
        <StatTile key={k.label} label={k.label} value={k.value} unit={k.unit} detail={k.detail} />
      ))}
    </section>
  );
}

export function Section({
  id,
  title,
  count,
  sub,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.sec} id={id} aria-labelledby={`${id}-title`}>
      <div className={styles.secHd}>
        <div>
          <h2 className={styles.secT} id={`${id}-title`}>
            {title}
            {count && <span className={styles.secN}>{count}</span>}
          </h2>
          {sub && <p className={styles.secSub}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "출처 · 기준" box under the data sections. */
export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <aside className={styles.source} aria-label="데이터 출처">
      {children}
    </aside>
  );
}

export { styles as seoStyles };
