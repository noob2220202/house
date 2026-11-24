'use client';
import { Button, Callout, Icon, Input, cx } from '@house/ui';
import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import { startTotpSetup, type TotpSetup } from '../../api';
import { formatRecoveryCode, secondFactorIssue, type SecondFactor } from '../../lib/otp';
import { authErrorMessage } from '../../lib/session';
import { OtpInput } from '../login/OtpInput';
import styles from '../core.module.css';
import loginStyles from '../login/login.module.css';

export interface TotpReauthFormProps {
  /** POST /admin/auth/totp/setup accepted the re-authentication: show the new QR. */
  onSetup: (setup: TotpSetup) => void;
  onCancel?: () => void;
}

type FieldErrors = { password?: string; factor?: string; form?: string };

/**
 * Step 1 of an authenticator re-enrolment from the account page. The API only starts a rotation
 * for a verified session that re-authenticates with the current password plus the current TOTP
 * code or a recovery code (`adminTotpSetupSchema`), so a hijacked session alone cannot swap the
 * second factor. The setup call is sent once, on submit: a TOTP step or recovery code it used is
 * spent.
 */
export function TotpReauthForm({ onSetup, onCancel }: TotpReauthFormProps) {
  const [password, setPassword] = useState('');
  const [kind, setKind] = useState<SecondFactor['kind']>('code');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const recoveryRef = useRef<HTMLInputElement>(null);
  const focusFactor = (k: SecondFactor['kind']) =>
    requestAnimationFrame(() => (k === 'code' ? codeRef : recoveryRef).current?.focus());

  const submit = async () => {
    if (busy) return;
    const factor: SecondFactor =
      kind === 'code' ? { kind, value: code } : { kind, value: recovery };
    const next: FieldErrors = {};
    if (!password) next.password = '현재 비밀번호를 입력해 주세요.';
    const factorIssue = secondFactorIssue(factor);
    if (factorIssue) next.factor = factorIssue;
    setErrors(next);
    if (next.password) return void passwordRef.current?.focus();
    if (next.factor) return void focusFactor(kind);

    setBusy(true);
    try {
      onSetup(await startTotpSetup({ currentPassword: password, factor }));
    } catch (error) {
      setBusy(false);
      const code_ = error instanceof ApiError ? error.code : '';
      if (code_ === 'AUTH_INVALID_CREDENTIALS') {
        setErrors({ password: '현재 비밀번호가 올바르지 않습니다.' });
        passwordRef.current?.focus();
      } else if (code_ === 'AUTH_TOTP_INVALID') {
        setErrors({
          factor:
            kind === 'recovery'
              ? '복구 코드가 올바르지 않거나 이미 사용한 코드입니다.'
              : authErrorMessage(error),
        });
        if (kind === 'code') setCode('');
        focusFactor(kind);
      } else {
        setErrors({ form: authErrorMessage(error) });
      }
    }
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {errors.form && (
        <Callout tone="danger" size="sm" live>
          {errors.form}
        </Callout>
      )}
      <Input
        ref={passwordRef}
        label="현재 비밀번호"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        disabled={busy}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (errors.password) setErrors((v) => ({ ...v, password: undefined }));
        }}
      />
      {kind === 'code' ? (
        <OtpInput
          ref={codeRef}
          label="지금 쓰는 인증 앱의 코드"
          value={code}
          onChange={(v) => {
            setCode(v);
            if (errors.factor) setErrors((e) => ({ ...e, factor: undefined }));
          }}
          error={errors.factor}
          disabled={busy}
        />
      ) : (
        <Input
          ref={recoveryRef}
          label="복구 코드"
          help="한 번 쓴 복구 코드는 다시 쓸 수 없습니다"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          value={recovery}
          disabled={busy}
          error={errors.factor}
          onChange={(e) => {
            setRecovery(formatRecoveryCode(e.target.value));
            if (errors.factor) setErrors((v) => ({ ...v, factor: undefined }));
          }}
        />
      )}
      <button
        type="button"
        className={cx(loginStyles.linkBtn, styles.alignStart)}
        disabled={busy}
        onClick={() => {
          const next = kind === 'code' ? 'recovery' : 'code';
          setKind(next);
          setErrors((v) => ({ ...v, factor: undefined }));
          focusFactor(next);
        }}
      >
        <Icon name={kind === 'code' ? 'key' : 'shield'} size={16} />
        {kind === 'code' ? '인증 앱을 쓸 수 없나요? 복구 코드로 확인' : '인증 앱 코드로 확인'}
      </button>
      <div className={styles.formActions}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            취소
          </Button>
        )}
        <Button type="submit" loading={busy}>
          본인 확인
        </Button>
      </div>
    </form>
  );
}
