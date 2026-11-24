import { Icon } from '@house/ui';
import styles from './signup.module.css';

const STEPS = ['간편 인증', '약관 · 관심 지역', '가입 완료'] as const;

/** Pill step indicator of the signup header (Login.dc.html `.steps`). `current` is zero-based. */
export function SignupSteps({ current }: { current: number }) {
  return (
    <ol className={styles.steps} aria-label="가입 단계">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'on' : 'todo';
        return (
          <li
            key={label}
            className={state === 'todo' ? undefined : styles[state]}
            aria-current={state === 'on' ? 'step' : undefined}
          >
            <span className={styles.stepN}>
              {state === 'done' ? <Icon name="check" size={16} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={styles.stepT}>
              <small>{i + 1}단계</small>
              {label}
              {state === 'done' && <span className="sr-only"> 완료</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
