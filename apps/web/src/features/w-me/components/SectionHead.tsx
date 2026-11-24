import { Icon } from '@house/ui';
import Link from 'next/link';
import styles from './SectionHead.module.css';

export interface SectionHeadProps {
  id?: string;
  title: string;
  count?: number;
  /** "전체 보기" link target. */
  href?: string;
  moreLabel?: string;
}

/** Section heading row of the overview: title + brand count + "전체 보기 ›". */
export function SectionHead({ id, title, count, href, moreLabel = '전체 보기' }: SectionHeadProps) {
  return (
    <div className={styles.head}>
      <h2 id={id} className={styles.title}>
        {title}
        {count !== undefined && count > 0 && (
          <span className={styles.count}>{count.toLocaleString('ko-KR')}</span>
        )}
      </h2>
      {href && (
        <Link href={href} className={styles.more}>
          {moreLabel}
          <span className="sr-only"> — {title}</span>
          <Icon name="chevron-right" size={16} />
        </Link>
      )}
    </div>
  );
}
