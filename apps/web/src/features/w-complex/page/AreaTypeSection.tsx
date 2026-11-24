'use client';
import { SegmentedControl } from '@house/ui';
import { useState } from 'react';
import { formatCount, formatManwon, formatSqm, sqmToPyeong, type AreaUnit } from '@/lib/format';
import type { ComplexAreaType, TradeRecord } from '../api/schemas';
import { areaTypeLabel } from '../lib/listing';
import { dealMonthLabel, latestByAreaType, tradeAmount } from '../lib/trend';
import styles from './page.module.css';

const UNIT_OPTIONS = [
  { value: 'sqm', label: '㎡' },
  { value: 'pyeong', label: '평' },
] as const;

const areaText = (sqm: number | null, unit: AreaUnit) =>
  sqm === null ? '–' : unit === 'sqm' ? formatSqm(sqm) : `${sqmToPyeong(sqm, 1)}평`;

function LatestCell({ trade }: { trade: TradeRecord | null }) {
  const amount = trade ? tradeAmount(trade) : null;
  if (!trade || amount === null) return <>–</>;
  return (
    <>
      <b>{formatManwon(amount)}</b>
      <small>{dealMonthLabel(trade.dealDate)}</small>
    </>
  );
}

export interface AreaTypeSectionProps {
  areaTypes: readonly ComplexAreaType[];
  /** Latest trade per 평형 × deal type (from the stats endpoint). */
  latest: readonly TradeRecord[];
}

/** 평형 정보: 공급/전용 면적 (㎡ ↔ 평), 세대수, 방·욕실 and the latest 매매 / 전세 실거래 per 평형. */
export function AreaTypeSection({ areaTypes, latest }: AreaTypeSectionProps) {
  const [unit, setUnit] = useState<AreaUnit>('sqm');
  const sale = latestByAreaType(areaTypes, latest, 'SALE');
  const jeonse = new Map(
    latestByAreaType(areaTypes, latest, 'JEONSE').map((r) => [r.areaType.id, r.trade]),
  );
  return (
    <section className={styles.sec} id="area-types" aria-labelledby="area-types-title">
      <div className={styles.secHd}>
        <h2 className={styles.secT} id="area-types-title">
          평형 정보<span className={styles.secN}>{areaTypes.length}</span>
        </h2>
        <SegmentedControl
          label="면적 단위"
          size="sm"
          options={UNIT_OPTIONS}
          value={unit}
          onChange={setUnit}
        />
      </div>
      <div className={`${styles.tableWrap} ${styles.areaTableWrap}`}>
        <table className={styles.table}>
          <caption className="sr-only">평형별 면적, 세대수와 최근 실거래가</caption>
          <thead>
            <tr>
              <th scope="col">평형</th>
              <th scope="col">공급 / 전용</th>
              <th scope="col" className={styles.r}>
                세대수
              </th>
              <th scope="col">방 / 욕실</th>
              <th scope="col" className={styles.r}>
                최근 매매 실거래
              </th>
              <th scope="col" className={styles.r}>
                최근 전세 실거래
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.map(({ areaType: a, trade }) => (
              <tr key={a.id}>
                <th scope="row">
                  <b>{areaTypeLabel(a)}</b>
                  {a.typeName && <small>{a.typeName}</small>}
                </th>
                <td>
                  {areaText(a.supplyArea, unit)} / {areaText(a.exclusiveArea, unit)}
                </td>
                <td className={styles.r}>
                  {a.households === null ? '–' : `${formatCount(a.households)}세대`}
                </td>
                <td>
                  {a.rooms === null && a.baths === null
                    ? '–'
                    : `${a.rooms ?? '–'}개 / ${a.baths ?? '–'}개`}
                </td>
                <td className={styles.r}>
                  <LatestCell trade={trade} />
                </td>
                <td className={styles.r}>
                  <LatestCell trade={jeonse.get(a.id) ?? null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phones: one card per 평형 instead of a six-column table (the table is hidden there). */}
      <ul className={styles.areaCards} aria-label="평형별 정보">
        {sale.map(({ areaType: a, trade }) => (
          <li key={a.id} className={styles.areaCard}>
            <p className={styles.acHd}>
              <b>{areaTypeLabel(a)}</b>
              {a.typeName && <small>{a.typeName}</small>}
              {a.households !== null && <span>{formatCount(a.households)}세대</span>}
            </p>
            <p className={styles.acSpec}>
              공급 {areaText(a.supplyArea, unit)} / 전용 {areaText(a.exclusiveArea, unit)}
              {(a.rooms !== null || a.baths !== null) &&
                ` · 방 ${a.rooms ?? '–'} / 욕실 ${a.baths ?? '–'}`}
            </p>
            <dl className={styles.acTrades}>
              <div>
                <dt>최근 매매</dt>
                <dd>
                  <LatestCell trade={trade} />
                </dd>
              </div>
              <div>
                <dt>최근 전세</dt>
                <dd>
                  <LatestCell trade={jeonse.get(a.id) ?? null} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
