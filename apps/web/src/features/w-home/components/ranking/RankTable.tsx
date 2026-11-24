import { RankDelta, cx } from '@house/ui';
import Link from 'next/link';
import { formatCount } from '@/lib/format/number';
import type { RankMode, RankRow } from '../../lib/ranking';
import styles from './Ranking.module.css';

const DEALS = [
  { key: 'presale', label: '분양' },
  { key: 'sale', label: '매매' },
  { key: 'jeonse', label: '전세' },
  { key: 'monthly', label: '월세' },
] as const;

/** Desktop ranking table for #2 and below (Main.dc.html `.rank-table`). */
export function RankTable({ rows, mode }: { rows: readonly RankRow[]; mode: RankMode }) {
  const from = rows[0]?.rank ?? 2;
  const to = rows[rows.length - 1]?.rank ?? from;
  // 평당가 means nothing for some categories (원룸 월세, 주택): the API sends null and the column
  // is left out instead of printing a column of dashes.
  const showValue = mode === 'complex' || rows.some((row) => row.value);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">
          사람들이 자주 찾는 {mode === 'complex' ? '단지' : '지역'} {from}위부터 {to}위
        </caption>
        <thead>
          <tr>
            <th scope="col">순위</th>
            <th scope="col">{mode === 'complex' ? '단지' : '지역'}</th>
            {DEALS.map((d) => (
              <th key={d.key} scope="col" className={cx(styles.c, styles[d.key])}>
                {d.label}
              </th>
            ))}
            {showValue && (
              <th scope="col" className={cx(styles.r, styles.wideCol)}>
                {mode === 'complex' ? '최근 거래' : '평균 평당가'}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <span className={styles.rk}>
                  <span className={styles.rankNo}>{row.rank}</span>
                  <RankDelta delta={row.delta} className={styles.delta} />
                </span>
              </td>
              <th scope="row" className={styles.nm}>
                <Link href={row.href} className={styles.strong}>
                  {row.name}
                </Link>
                <span className={styles.cap}>
                  {row.place}
                  {row.placeExtra && <span className={styles.wideInline}> · {row.placeExtra}</span>}
                </span>
              </th>
              {DEALS.map((d) => (
                <td
                  key={d.key}
                  className={cx(
                    styles.c,
                    'num',
                    row.counts[d.key] === 0 ? styles.zero : styles.strong,
                  )}
                >
                  {formatCount(row.counts[d.key])}
                </td>
              ))}
              {showValue && (
                <td className={cx(styles.r, styles.wideCol)}>
                  {row.value ? (
                    <>
                      <b className={cx(styles.strong, 'num')}>{row.value.main}</b>
                      {row.value.caption && <span className={styles.cap}>{row.value.caption}</span>}
                    </>
                  ) : (
                    <span className={styles.zero}>–</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
