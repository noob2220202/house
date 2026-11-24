import { CategoryIcon, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format/number';
import { HOME_CATEGORIES } from '../../config';
import styles from './CategoryGrid.module.css';

export interface CategoryGridProps {
  /** Active listings keyed by AssetType (`GET /home/summary`); counts are hidden while unknown. */
  counts: Record<string, number> | undefined;
}

/** Five category entries into the map search. Desktop: one row of cards; mobile: 2 large + 3 compact. */
export function CategoryGrid({ counts }: CategoryGridProps) {
  return (
    <section className={styles.section} aria-label="매물 종류">
      <ul className={`container ${styles.grid}`}>
        {HOME_CATEGORIES.map((c) => {
          const known = counts && c.assetTypes.some((t) => typeof counts[t] === 'number');
          const count = known ? c.assetTypes.reduce((sum, t) => sum + (counts[t] ?? 0), 0) : null;
          return (
            <li key={c.slug} className={styles.item}>
              <Link href={ROUTES.map(c.slug)} className={styles.card}>
                <span className={styles.tile}>
                  <CategoryIcon name={c.icon} size={28} />
                </span>
                <span className={styles.text}>
                  <span className={styles.title}>{c.label}</span>
                  <span className={styles.caption}>{c.caption}</span>
                  <span className={styles.countSm}>
                    {count === null ? (
                      '매물 보기'
                    ) : (
                      <>
                        매물 <b className="num">{formatCount(count)}</b>
                      </>
                    )}
                  </span>
                </span>
                <span className={styles.foot}>
                  <span>
                    {count === null ? (
                      '매물 보기'
                    ) : (
                      <>
                        매물 <b>{formatCount(count)}</b>
                      </>
                    )}
                  </span>
                  <Icon name="arrow-right" size={18} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
