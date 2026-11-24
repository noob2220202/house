'use client';
import { Button, Callout, Icon, cx } from '@house/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';
import { api } from '@/lib/api';
import { verifyTotp, type TotpResult } from '../../api';
import { CredentialsForm, type CredentialsValues } from './CredentialsForm';
import { DevLoginPanel } from './DevLoginPanel';
import styles from './login.module.css';
import { TotpEnroll } from './TotpEnroll';
import { RecoveryCodes, TotpCodeForm } from './TotpStep';

type Step = 'credentials' | 'verify' | 'enroll' | 'recovery';

export interface LoginScreenProps {
  /** Safe, site-relative path to open after login. */
  returnTo: string;
  /** Notice above the form (e.g. session expired). */
  notice?: string | null;
  /** Mock mode: show the dev helper. */
  mock?: boolean;
}

const HEAD: Record<Step, { title: string; sub: React.ReactNode }> = {
  credentials: {
    title: '관리자 로그인',
    sub: '운영자 계정의 이메일과 비밀번호를 입력하세요. 다음 단계에서 2단계 인증을 진행합니다.',
  },
  verify: {
    title: '2단계 인증',
    sub: '인증 앱에 표시된 6자리 코드를 입력하세요. 코드는 30초마다 바뀝니다.',
  },
  enroll: {
    title: '인증 앱 등록',
    sub: '관리자 계정은 2단계 인증이 필수입니다. 처음 한 번만 인증 앱을 연결해 주세요.',
  },
  recovery: {
    title: '복구 코드를 보관하세요',
    sub: '휴대폰을 잃어버렸을 때 쓰는 일회용 코드입니다. 지금만 볼 수 있으니 안전한 곳에 저장해 주세요.',
  },
};

/** Email + password → TOTP (verify or first-time enrolment) → console. */
export function LoginScreen({ returnTo, notice, mock }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [flash, setFlash] = useState<string | null>(notice ?? null);
  const [preset, setPreset] = useState<Partial<CredentialsValues> | null>(null);
  const [codes, setCodes] = useState<readonly string[]>([]);
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the step heading so keyboard / screen-reader users follow the flow (the verify
  // step focuses its code field instead). Without this, focus falls back to <body> when the
  // previous step's form unmounts.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (step !== 'verify') titleRef.current?.focus();
  }, [step]);

  const enter = useCallback(() => {
    setLeaving(true);
    // Full navigation: the server layout must see the upgraded session cookie.
    window.location.assign(returnTo);
  }, [returnTo]);

  const onVerified = useCallback(
    (result: TotpResult) => {
      if (result.recoveryCodes && result.recoveryCodes.length > 0) {
        setCodes(result.recoveryCodes);
        setStep('recovery');
      } else enter();
    },
    [enter],
  );

  const restart = useCallback((message?: string) => {
    setFlash(message ?? null);
    setCodes([]);
    setStep('credentials');
  }, []);

  const cancel = () => {
    // Drop the half-authenticated session, then start over.
    api.post('/admin/auth/logout').catch(() => undefined);
    restart();
  };

  const head = HEAD[step];
  const stepIndex = step === 'credentials' ? 0 : 1;

  return (
    <div className={styles.page}>
      <aside className={styles.aside}>
        <div className={styles.brandRow}>
          <Logo tone="ink" size={30} />
          <span className={styles.env}>{BRAND.consoleLabel}</span>
        </div>
        <div className={styles.pitch}>
          <p className={styles.eyebrow}>{BRAND.tagline}</p>
          <p className={styles.headline}>
            매물부터 배너까지,
            <br />
            운영의 모든 것을 한곳에서
          </p>
          <ul className={styles.points}>
            <li>
              <Icon name="shield" size={18} />
              모든 관리자 계정은 2단계 인증(TOTP)으로 보호됩니다
            </li>
            <li>
              <Icon name="document" size={18} />
              승인 · 반려 · 설정 변경은 작업 기록에 남습니다
            </li>
            <li>
              <Icon name="clock" size={18} />
              일정 시간 사용하지 않으면 자동으로 로그아웃됩니다
            </li>
          </ul>
        </div>
        <p className={styles.legal}>
          허가된 운영자만 접속할 수 있습니다. 접속 기록은 보안 목적으로 보관됩니다.
        </p>
      </aside>

      <main className={styles.main}>
        <div className={styles.card}>
          <ol className={styles.steps} aria-label="로그인 단계">
            {['계정 확인', '2단계 인증'].map((label, i) => (
              <li key={label} style={{ display: 'contents' }}>
                {i > 0 && <span className={styles.stepLine} aria-hidden="true" />}
                <span
                  className={cx(
                    styles.step,
                    i === stepIndex && styles.on,
                    i < stepIndex && styles.done,
                  )}
                  aria-current={i === stepIndex ? 'step' : undefined}
                >
                  <span className={styles.stepN} aria-hidden="true">
                    {i < stepIndex ? <Icon name="check" size={14} /> : i + 1}
                  </span>
                  {label}
                  {i < stepIndex && <span className="sr-only"> 완료</span>}
                </span>
              </li>
            ))}
          </ol>

          <div className={styles.head}>
            <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
              {head.title}
            </h1>
            <p className={styles.sub}>
              {step !== 'credentials' && step !== 'recovery' && email && (
                <>
                  <b>{email}</b>
                  <br />
                </>
              )}
              {head.sub}
            </p>
          </div>

          {flash && step === 'credentials' && (
            <Callout tone="info" size="sm" live>
              {flash}
            </Callout>
          )}

          {step === 'credentials' && (
            <CredentialsForm
              preset={preset}
              onSuccess={(result, value) => {
                setFlash(null);
                setEmail(value);
                setStep(result.totpEnrolled ? 'verify' : 'enroll');
              }}
            />
          )}

          {step === 'verify' && (
            <>
              <TotpCodeForm
                action={verifyTotp}
                allowRecovery
                onVerified={onVerified}
                onSessionLost={restart}
              />
              <div className={styles.foot}>
                <button type="button" className={styles.linkBtn} onClick={cancel}>
                  <Icon name="chevron-left" size={16} />
                  다른 계정으로 로그인
                </button>
              </div>
            </>
          )}

          {step === 'enroll' && (
            <>
              <TotpEnroll onVerified={onVerified} onSessionLost={restart} />
              <div className={styles.foot}>
                <button type="button" className={styles.linkBtn} onClick={cancel}>
                  <Icon name="chevron-left" size={16} />
                  다른 계정으로 로그인
                </button>
              </div>
            </>
          )}

          {step === 'recovery' && (
            <div className={styles.form}>
              <RecoveryCodes codes={codes} />
              <label className={styles.foot} style={{ justifyContent: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--brand)' }}
                />
                <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>
                  복구 코드를 안전한 곳에 보관했습니다
                </span>
              </label>
              <Button size="lg" block disabled={!saved} loading={leaving} onClick={enter}>
                관리자 콘솔로 이동
              </Button>
            </div>
          )}
        </div>

        {step === 'verify' && (
          <p className={styles.help}>
            인증 앱을 사용할 수 없다면 복구 코드로 인증하세요. 복구 코드도 없다면 최고관리자에게
            2단계 인증 초기화를 요청해 주세요.
          </p>
        )}
        {step === 'credentials' && !mock && (
          <p className={styles.help}>비밀번호를 잊었다면 최고관리자에게 재설정을 요청해 주세요.</p>
        )}
        {mock && step === 'credentials' && (
          <DevLoginPanel returnTo={returnTo} onPick={(c) => setPreset({ ...c })} />
        )}
      </main>
    </div>
  );
}
