import { cx } from '@house/ui';
import type { ReactNode } from 'react';
import s from './shared.module.css';

/** Sticky action bar at the bottom of long forms: status text on the left, buttons on the right. */
export function SaveBar({
  dirty,
  info,
  inset,
  children,
}: {
  /** Shows "저장하지 않은 변경 사항이 있어요". */
  dirty?: boolean;
  /** Text shown when the form is clean (e.g. last saved time). */
  info?: ReactNode;
  /** Floating card inside a column instead of the full-bleed bar under a page-wide form. */
  inset?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx(s.saveBar, inset && s.saveBarInset)}>
      <p className={cx(s.saveBarInfo, dirty && s.saveBarDirty)} aria-live="polite">
        {dirty ? '저장하지 않은 변경 사항이 있어요' : info}
      </p>
      <div className={s.saveBarActions}>{children}</div>
    </div>
  );
}
