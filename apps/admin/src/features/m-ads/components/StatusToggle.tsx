'use client';
import { BannerStatus } from '@house/shared';
import { cx, Switch } from '@house/ui';
import { scheduleStatus, STATUS_LABEL, statusCaption, type Schedule } from '../lib/status';
import styles from './ads.module.css';

const STATUS_CLASS: Record<BannerStatus, string | undefined> = {
  ACTIVE: styles.stLive,
  SCHEDULED: styles.stScheduled,
  PAUSED: styles.stPaused,
  ENDED: styles.stEnded,
};

export interface StatusToggleProps {
  item: Schedule & { memo?: string | null };
  /** Name for the accessible label: "AD-01 연향들 더 퍼스트 …". */
  name: string;
  disabled?: boolean;
  onToggle: (paused: boolean) => void;
}

/**
 * 노출 switch of a list row. On = not paused; the label shows the computed status
 * (노출 / 예약 / 중지 / 종료) and the caption what comes next ("7일 남음", "12.01 시작").
 */
export function StatusToggle({ item, name, disabled, onToggle }: StatusToggleProps) {
  const status = scheduleStatus(item);
  const ended = status === BannerStatus.ENDED;
  return (
    <div className={cx(styles.st, STATUS_CLASS[status])}>
      <Switch
        checked={!item.paused && !ended}
        disabled={disabled || ended}
        aria-label={`${name} 노출 켜기 (현재 ${STATUS_LABEL[status]})`}
        onChange={(e) => onToggle(!e.target.checked)}
      >
        {STATUS_LABEL[status]}
      </Switch>
      <span className={styles.cap}>{statusCaption(item)}</span>
    </div>
  );
}
