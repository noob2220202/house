import { FormRow as UiFormRow, Icon, type FormRowProps as UiFormRowProps } from '@house/ui';
import type { ReactNode } from 'react';
import styles from './wizard.module.css';

/**
 * Form layout of the listing wizard = the shared @house/ui components (FormSection, FormRow,
 * FieldError, HelpLine, ChoiceChip, MoneyInput — the same as the 내놓기 · 구하기 forms). Only the
 * 표시·광고 명시사항 mark is specific to this wizard.
 */

/** "명시사항" mark next to a label (표시·광고 명시사항, 공인중개사법 시행규칙). */
export function LegalMark() {
  return (
    <span className={styles.legalMark}>
      <Icon name="shield" size={12} />
      명시사항
    </span>
  );
}

export interface FormRowProps extends UiFormRowProps {
  /** 표시·광고 명시사항 — shows the "명시사항" mark next to the label. */
  legal?: boolean;
}

/** The shared FormRow + the optional 명시사항 mark. */
export function FormRow({ legal, labelAside, ...props }: FormRowProps) {
  return <UiFormRow {...props} labelAside={legal ? <LegalMark /> : labelAside} />;
}

/** Live readout next to a control ("= 34평", "= 4억 4,500만원"). */
export function Readout({ children }: { children: ReactNode }) {
  return (
    <span className={styles.readout} aria-live="polite">
      {children}
    </span>
  );
}
