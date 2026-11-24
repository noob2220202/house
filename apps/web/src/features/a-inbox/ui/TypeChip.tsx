import { DEAL_REQUEST_TYPE_LABEL, DealRequestType } from '@house/shared';
import { cx } from '@house/ui';
import styles from './inbox.module.css';

/** 내놓기 (cobalt) / 구하기 (champagne) chip — same colours as the console dashboard. */
export function TypeChip({ type }: { type: DealRequestType }) {
  const sell = type === DealRequestType.SELL_OR_LEASE;
  return (
    <span className={cx(styles.chip, sell ? styles.chipSell : styles.chipWant)}>
      {DEAL_REQUEST_TYPE_LABEL[type]}
    </span>
  );
}

/** "지정 요청" — the requester picked this office (SELECTED_AGENCIES). */
export function TargetedChip() {
  return <span className={cx(styles.chip, styles.chipTarget)}>지정 요청</span>;
}
