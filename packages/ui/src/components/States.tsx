import type { ReactNode } from 'react';
import styles from './States.module.css';
import { cx } from '../lib/cx';
import { Button } from './Button';
import { Icon, type IconName } from '../icons/Icon';

export interface EmptyStateProps {
  /** Icon name from the set (default: search). */
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  /** Primary action (Button / link). */
  action?: ReactNode;
  /** Compact variant for panels and list cells. */
  compact?: boolean;
  className?: string;
}

/** Empty result placeholder: say what is empty and what to do next. */
export function EmptyState({
  icon = 'search',
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.state, compact && styles.compact, className)}>
      <span className={styles.icon}>
        <Icon name={icon} size={compact ? 22 : 28} />
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Shows a 다시 시도 button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra action next to retry (e.g. 홈으로). */
  action?: ReactNode;
  /** Error code / request id shown small for support. */
  code?: string;
  compact?: boolean;
  className?: string;
}

/** Error placeholder for failed data views (role="alert"). */
export function ErrorState({
  title = '정보를 불러오지 못했어요',
  description = '잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 알려 주세요.',
  onRetry,
  retryLabel = '다시 시도',
  action,
  code,
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div className={cx(styles.state, compact && styles.compact, className)} role="alert">
      <span className={cx(styles.icon, styles.iconDanger)}>
        <Icon name="alert" size={compact ? 22 : 28} />
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.desc}>{description}</p>}
      {(onRetry || action) && (
        <div className={styles.action}>
          {onRetry && (
            <Button
              variant="secondary"
              size={compact ? 'sm' : 'md'}
              iconLeft={<Icon name="refresh" size={18} />}
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
      {code && <p className={styles.code}>오류 코드 {code}</p>}
    </div>
  );
}
