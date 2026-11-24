import { Breadcrumb, Callout, Skeleton } from '@house/ui';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import styles from './form.module.css';
import { LoginRow, WizardFooter, WizardStepper } from './parts';
import type { WizardState, WizardUser } from './useWizard';

export interface WizardShellProps {
  /** "내 집 내놓기" */
  eyebrow: string;
  /** Page heading for the current step. */
  title: string;
  /** Breadcrumb label of this page. */
  crumb: string;
  steps: readonly { label: string }[];
  stepperLabel: string;
  wizard: WizardState;
  user: WizardUser;
  submitLabel: string;
  submitting: boolean;
  /** Why the primary button is disabled right now (e.g. photos still uploading). */
  blocked?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Notice above the footer on the last step. */
  notice?: ReactNode;
  /** Submit error (role="alert"). */
  error?: ReactNode;
  aside: ReactNode;
  children: ReactNode;
}

/** Page frame of both wizards: heading, form card (stepper · body · footer) and the sticky aside. */
export function WizardShell({
  eyebrow,
  title,
  crumb,
  steps,
  stepperLabel,
  wizard,
  user,
  submitLabel,
  submitting,
  blocked,
  onSubmit,
  notice,
  error,
  aside,
  children,
}: WizardShellProps) {
  return (
    <section className={styles.sec} aria-labelledby="deal-form-t">
      <div className="container">
        <Breadcrumb
          className={styles.crumb}
          linkAs={Link}
          items={[
            { label: '홈', href: ROUTES.home },
            { label: '내놓기 · 구하기', href: ROUTES.deal },
            { label: crumb },
          ]}
        />
        <div className={styles.secHd}>
          <div className={styles.secTitle}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 id="deal-form-t" className="t-h1" tabIndex={-1} data-step-heading>
              {title}
            </h1>
          </div>
          <p className="t-sm">* 표시는 필수 항목이에요. 입력한 내용은 자동으로 저장돼요.</p>
        </div>
        <div className={styles.layout}>
          <form
            ref={wizard.formRef}
            className={styles.form}
            onSubmit={onSubmit}
            noValidate
            aria-labelledby="deal-form-t"
          >
            <div className={styles.formHd}>
              <WizardStepper
                steps={steps}
                current={wizard.step}
                label={stepperLabel}
                onSelect={submitting ? undefined : wizard.goTo}
              />
              <LoginRow name={user.displayName} />
            </div>
            {wizard.ready ? (
              children
            ) : (
              <div
                className={styles.skeleton}
                role="status"
                aria-label="작성 중이던 내용을 불러오는 중"
              >
                <Skeleton width={180} height={26} />
                <Skeleton height={92} radius={16} />
                <Skeleton height={48} radius={12} />
                <Skeleton height={48} radius={12} width="60%" />
              </div>
            )}
            {wizard.ready && wizard.step === wizard.lastStep && notice && (
              <Callout size="sm" className={styles.notice}>
                {notice}
              </Callout>
            )}
            {error && <div className={styles.submitErr}>{error}</div>}
            <WizardFooter
              step={wizard.step}
              lastStep={wizard.lastStep}
              savedAt={wizard.savedAt}
              onPrev={wizard.prev}
              submitLabel={submitLabel}
              submitting={submitting}
              blocked={blocked}
            />
          </form>
          <aside className={styles.aside} aria-label={`${crumb} 요약`}>
            {aside}
          </aside>
        </div>
      </div>
    </section>
  );
}
