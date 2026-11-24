import { type AssetType } from '@house/shared';
import { Button, CategoryIcon, cx, Icon, Spinner } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatSavedTime } from '../../lib/draft';
import { ASSET_TILES } from '../../lib/labels';
import styles from './form.module.css';

// Form layout (FormSection / FormRow / FieldError / HelpLine) and the pill options (ChoiceChip)
// come from @house/ui — the same components as the broker console's listing wizard.

export interface WizardStepperProps {
  steps: readonly { label: string }[];
  current: number;
  label: string;
  /** Go back to an earlier (completed) step. */
  onSelect?: (index: number) => void;
}

/** Progress header of the wizard (design `.dr-stepper`): done ✓ · current ring · upcoming grey. */
export function WizardStepper({ steps, current, label, onSelect }: WizardStepperProps) {
  return (
    <ol className={styles.stepper} aria-label={label}>
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        const body = (
          <>
            <span className={styles.spC}>{done ? <Icon name="check" size={18} /> : i + 1}</span>
            <span className={styles.spT}>
              <em>
                {i + 1}단계{done ? ' · 완료' : on ? ' · 작성 중' : ''}
              </em>
              {s.label}
            </span>
          </>
        );
        return (
          <li
            key={s.label}
            className={cx(done && styles.done, on && styles.on)}
            aria-current={on ? 'step' : undefined}
          >
            {done && onSelect ? (
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => onSelect(i)}
                aria-label={`${i + 1}단계 ${s.label} 수정하기`}
              >
                {body}
              </button>
            ) : (
              <span className={styles.stepBtn}>{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** "○○ 님으로 작성 중" row under the stepper. */
export function LoginRow({ name }: { name: string }) {
  return (
    <div className={styles.login}>
      <span className={styles.loginK} aria-hidden="true">
        <Icon name="user" size={16} />
      </span>
      <span>
        로그인됨 · <b>{name}</b> 님
      </span>
      <Link className={cx('link', styles.loginLink)} href={ROUTES.myRequests}>
        내 요청 보기
      </Link>
    </div>
  );
}

export interface WizardFooterProps {
  step: number;
  lastStep: number;
  savedAt: string | null;
  onPrev: () => void;
  /** Label of the final submit button. */
  submitLabel: string;
  submitting?: boolean;
  /** Disables the primary button and says why (replaces the autosave line meanwhile). */
  blocked?: string;
}

/** Card footer: 이전 · autosave time · 다음 단계로 / submit. The primary button is the form's submit. */
export function WizardFooter({
  step,
  lastStep,
  savedAt,
  onPrev,
  submitLabel,
  submitting,
  blocked,
}: WizardFooterProps) {
  const isLast = step === lastStep;
  return (
    <div className={styles.formFt}>
      {step === 0 ? (
        <Button
          href={ROUTES.deal}
          linkAs={Link}
          variant="secondary"
          size="lg"
          className={styles.prev}
          iconLeft={<Icon name="chevron-left" size={20} />}
        >
          이전
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className={styles.prev}
          onClick={onPrev}
          disabled={submitting}
          iconLeft={<Icon name="chevron-left" size={20} />}
        >
          이전
        </Button>
      )}
      <span className={styles.saved} role="status">
        {blocked ? (
          <>
            <Spinner size={16} />
            {blocked}
          </>
        ) : (
          savedAt && (
            <>
              <Icon name="check" size={16} />
              {formatSavedTime(savedAt)} 자동 저장됨
            </>
          )
        )}
      </span>
      <Button
        type="submit"
        size="lg"
        className={styles.next}
        loading={submitting}
        disabled={!!blocked}
        iconRight={<Icon name={isLast ? 'check' : 'arrow-right'} size={20} />}
      >
        {isLast ? submitLabel : '다음 단계로'}
      </Button>
    </div>
  );
}

/** Radio tiles for the asset type (아파트·분양권 / 오피스텔 / 원룸·투룸 / 주택 / 상업·업무 / 토지). */
export function AssetTypeTiles({
  name,
  value,
  onChange,
  labelledBy,
  invalid,
}: {
  name: string;
  value: AssetType | '';
  onChange: (value: AssetType) => void;
  labelledBy: string;
  invalid?: boolean;
}) {
  return (
    <div
      className={styles.types}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
    >
      {ASSET_TILES.map((t) => (
        <label key={t.value} className={cx(styles.type, value === t.value && styles.sel)}>
          <input
            className="sr-only"
            type="radio"
            name={name}
            value={t.value}
            checked={value === t.value}
            onChange={() => onChange(t.value)}
          />
          {typeof t.icon === 'string' ? (
            <CategoryIcon name={t.icon} size={26} />
          ) : (
            <Icon name={t.icon.icon} size={26} />
          )}
          <span>{t.label}</span>
        </label>
      ))}
    </div>
  );
}
