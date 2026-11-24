import { DealCount, RankDelta } from '@house/ui';
import Link from 'next/link';
import type { RankRow } from '../../lib/ranking';
import styles from './Ranking.module.css';

/** Mobile ranking rows for #2–#4 (MobileHome `.rklist`). */
export function RankList({ rows }: { rows: readonly RankRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ol className={styles.list} start={rows[0]?.rank ?? 2}>
      {rows.map((row) => (
        <li key={row.key}>
          <Link href={row.href} className={styles.item}>
            <span className={styles.itemNo}>
              <b className="num">{row.rank}</b>
              {row.delta !== 0 && <RankDelta delta={row.delta} />}
            </span>
            <span className={styles.itemMain}>
              <b className={styles.itemName}>{row.name}</b>
              <span className={styles.itemLoc}>{row.mobileCaption}</span>
            </span>
            <DealCount counts={row.counts} className={styles.itemCounts} />
          </Link>
        </li>
      ))}
    </ol>
  );
}
