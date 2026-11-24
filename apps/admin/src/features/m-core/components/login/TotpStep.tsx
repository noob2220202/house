'use client';
import { Button, Icon } from '@house/ui';
import { useRef, useState } from 'react';
import { verifyTotp, type TotpVerifyResult } from '../../api';
import { authErrorMessage, mustRestartLogin } from '../../lib/session';
import styles from './login.module.css';
import { OtpInput } from './OtpInput';

export interface TotpCodeFormProps {
  submitLabel?: string;
  onVerified: (result: TotpVerifyResult) => void;
  /** The half-authenticated session expired — the flow has to start over. */
  onSessionLost?: (message: string) => void;
  autoFocus?: boolean;
}

/** Six-digit TOTP entry + POST /admin/auth/totp/verify. Submits by itself once six digits are in. */
export function TotpCodeForm({
  submitLabel = '확인',
  onVerified,
  onSessionLost,
  autoFocus = true,
}: TotpCodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (value: string) => {
    if (busy) return;
    if (value.length !== 6) {
      setError('인증 코드 6자리를 입력해 주세요.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onVerified(await verifyTotp(value));
    } catch (e) {
      if (mustRestartLogin(e) && onSessionLost) {
        onSessionLost(authErrorMessage(e));
        return;
      }
      setError(authErrorMessage(e));
      setCode('');
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(code);
      }}
    >
      <OtpInput
        ref={inputRef}
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v) => void submit(v)}
        error={error}
        disabled={busy}
        autoFocus={autoFocus}
      />
      <Button type="submit" size="lg" block loading={busy}>
        {submitLabel}
      </Button>
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
