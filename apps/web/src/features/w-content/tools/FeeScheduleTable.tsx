import { cx } from '@house/ui';
import {
  BROKERAGE_FEE_SCHEDULE,
  bracketRangeLabel,
  type BrokerageFeeSchedule,
  type FeeBracket,
} from './lib/brokerage-fee';
import { formatRatePct } from './lib/money';
import styles from './tools.module.css';

export interface FeeScheduleTableProps {
  schedule?: BrokerageFeeSchedule;
  /** Row to highlight (the bracket the calculator applied). */
  highlight?: { table: 'sale' | 'lease'; index: number } | null;
}

function Brackets({
  caption,
  brackets,
  highlight,
}: {
  caption: string;
  brackets: readonly FeeBracket[];
  highlight: number | null;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">거래금액</th>
            <th scope="col" className={styles.right}>
              상한요율
            </th>
            <th scope="col" className={styles.right}>
              한도액
            </th>
          </tr>
        </thead>
        <tbody>
          {brackets.map((b, i) => (
            <tr key={i} className={cx(highlight === i && styles.hit)}>
              <th scope="row">
                {bracketRangeLabel(brackets, i)}
                {highlight === i && <span className={styles.hitTag}>적용</span>}
              </th>
              <td className={cx(styles.right, 'num')}>{formatRatePct(b.ratePct)}</td>
              <td className={cx(styles.right, 'num')}>
                {b.capManwon !== undefined ? `${b.capManwon}만원` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 주택 중개보수 상한요율표 (매매·교환 / 임대차) + 오피스텔 · 주택 외 summary. Data-driven. */
export function FeeScheduleTable({
  schedule = BROKERAGE_FEE_SCHEDULE,
  highlight = null,
}: FeeScheduleTableProps) {
  return (
    <div className={styles.schedule}>
      <div className={styles.scheduleGrid}>
        <Brackets
          caption="주택 매매 · 교환"
          brackets={schedule.housing.sale}
          highlight={highlight?.table === 'sale' ? highlight.index : null}
        />
        <Brackets
          caption="주택 임대차 (전세 · 월세)"
          brackets={schedule.housing.lease}
          highlight={highlight?.table === 'lease' ? highlight.index : null}
        />
      </div>
      <dl className={styles.scheduleExtra}>
        <div>
          <dt>주거용 오피스텔</dt>
          <dd>
            매매 {formatRatePct(schedule.officetel.saleRatePct)} · 임대차{' '}
            {formatRatePct(schedule.officetel.leaseRatePct)} (전용 85㎡ 이하, 주거 설비를 갖춘 경우)
          </dd>
        </div>
        <div>
          <dt>토지 · 상가 · 그 밖의 건물</dt>
          <dd>거래금액의 {formatRatePct(schedule.other.maxRatePct)} 안에서 중개사무소와 협의</dd>
        </div>
        <div>
          <dt>월세 거래금액</dt>
          <dd>
            보증금 + 월세 × {schedule.monthly.multiplier}. 이 금액이{' '}
            {schedule.monthly.lowThresholdManwon / 1_000}천만원 미만이면 보증금 + 월세 ×{' '}
            {schedule.monthly.lowMultiplier}
          </dd>
        </div>
      </dl>
      <p className={styles.scheduleSource}>
        {schedule.label} · {schedule.effectiveFrom.replace(/-/g, '.')} 시행
      </p>
    </div>
  );
}
