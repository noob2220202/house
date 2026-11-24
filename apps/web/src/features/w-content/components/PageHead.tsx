import { Breadcrumb, cx, type BreadcrumbItem } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import styles from './PageHead.module.css';

export interface PageHeadProps {
  title: ReactNode;
  description?: ReactNode;
  /** Trail after 홈. The last item is the current page. */
  crumbs?: readonly BreadcrumbItem[];
  /** Right side on desktop, below the description on mobile. */
  actions?: ReactNode;
  /** Small brand-coloured line above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

/** Title block of the content pages: breadcrumb · h1 · description (same scale as the Main section heads). */
export function PageHead({
  title,
  description,
  crumbs,
  actions,
  eyebrow,
  className,
}: PageHeadProps) {
  return (
    <header className={cx(styles.head, className)}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb
          linkAs={Link}
          items={[{ label: '홈', href: ROUTES.home }, ...crumbs]}
          className={styles.crumb}
        />
      )}
      <div className={styles.row}>
        <div className={styles.text}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="t-h1">{title}</h1>
          {description && <p className={styles.desc}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
