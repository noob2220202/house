'use client';
import { Button, Icon, Input } from '@house/ui';
import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import type { TotpResult } from '../../api';
import { formatRecoveryCode, secondFactorIssue, type SecondFactor } from '../../lib/otp';
import { authErrorMessage, mustRestartLogin } from '../../lib/session';
import styles from './login.module.css';
import { OtpInput } from './OtpInput';

export interface TotpCodeFormProps {
  /**
   * The API call for the entered factor: POST /admin/auth/totp/verify (login of an enrolled admin)
   * or POST /admin/auth/totp/activate (confirming an enrolment, TOTP code only).
   */
  action: (factor: SecondFactor) => Promise<TotpResult>;
  submitLabel?: string;
  onVerified: (result: TotpResult) => void;
  /** The half-authenticated session expired — the flow has to start over. */
  onSessionLost?: (message: string) => void;
  /** The API answered this code instead of a form error (e.g. `AUTH_TOTP_SETUP_EXPIRED`). */
  onErrorCode?: (code: string, message: string) => boolean;
  /** Offer "복구 코드로 인증" (verification only; an enrolment is confirmed with a TOTP code). */
  allowRecovery?: boolean;
  autoFocus?: boolean;
}

/** Form message for a refused factor (a recovery code gets its own wording). */
function factorErrorMessage(error: unknown, kind: SecondFactor['kind']): string {
  if (kind === 'recovery' && error instanceof ApiError && error.code === 'AUTH_TOTP_INVALID')
    return '복구 코드가 올바르지 않거나 이미 사용한 코드입니다.';
  return authErrorMessage(error);
}

/**
 * Second-factor entry: six-digit TOTP (submits by itself once six digits are in) or, when
 * `allowRecovery`, one of the one-time recovery codes.
 */
export function TotpCodeForm({
  action,
  submitLabel = '확인',
  onVerified,
  onSessionLost,
  onErrorCode,
  allowRecovery = false,
  autoFocus = true,
}: TotpCodeFormProps) {
  const [kind, setKind] = useState<SecondFactor['kind']>('code');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const recoveryRef = useRef<HTMLInputElement>(null);
  const focusField = (k: SecondFactor['kind']) =>
    requestAnimationFrame(() => (k === 'code' ? codeRef : recoveryRef).current?.focus());

  const submit = async (factor: SecondFactor) => {
    if (busy) return;
    const issue = secondFactorIssue(factor);
    if (issue) {
      setError(issue);
      focusField(factor.kind);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onVerified(await action(factor));
    } catch (e) {
      if (mustRestartLogin(e) && onSessionLost) {
        onSessionLost(authErrorMessage(e));
        return;
      }
      setBusy(false);
      if (e instanceof ApiError && onErrorCode?.(e.code, authErrorMessage(e))) return;
      setError(factorErrorMessage(e, factor.kind));
      if (factor.kind === 'code') setCode('');
      focusField(factor.kind);
    }
  };

  const switchTo = (next: SecondFactor['kind']) => {
    setKind(next);
    setError(null);
    focusField(next);
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(kind === 'code' ? { kind, value: code } : { kind, value: recovery });
      }}
    >
      {kind === 'code' ? (
        <OtpInput
          ref={codeRef}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={(v) => void submit({ kind: 'code', value: v })}
          error={error}
          disabled={busy}
          autoFocus={autoFocus}
        />
      ) : (
        <Input
          ref={recoveryRef}
          label="복구 코드"
          help="등록할 때 받은 8자리 코드 (예: ABCD-EFGH) · 한 번 쓴 코드는 다시 쓸 수 없습니다"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          value={recovery}
          disabled={busy}
          error={error ?? undefined}
          onChange={(e) => {
            setRecovery(formatRecoveryCode(e.target.value));
            if (error) setError(null);
          }}
        />
      )}
      <Button type="submit" size="lg" block loading={busy}>
        {submitLabel}
      </Button>
      {allowRecovery && (
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => switchTo(kind === 'code' ? 'recovery' : 'code')}
          disabled={busy}
        >
          <Icon name={kind === 'code' ? 'key' : 'shield'} size={16} />
          {kind === 'code' ? '복구 코드로 인증' : '인증 앱 코드로 인증'}
        </button>
      )}
    </form>
  );
}

export interface RecoveryCodesProps {
  codes: readonly string[];
  /** File name for the download (no personal data). */
  fileName?: string;
}

/** One-time recovery codes: copy / download. */
export function RecoveryCodes({
  codes,
  fileName = 'admin-recovery-codes.txt',
}: RecoveryCodesProps) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    // Revoking in the same task can cancel the download in Firefox / Safari.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <ul className={styles.codes} aria-label="복구 코드">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className={styles.codeActions}>
        <Button
          variant="secondary"
          iconLeft={<Icon name={copied ? 'check' : 'copy'} size={18} />}
          onClick={() => void copy()}
        >
          {copied ? '복사했어요' : '모두 복사'}
        </Button>
        <Button
          variant="secondary"
          iconLeft={<Icon name="download" size={18} />}
          onClick={download}
        >
          텍스트로 저장
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? '복구 코드를 복사했습니다.' : ''}
      </span>
    </>
  );
}
