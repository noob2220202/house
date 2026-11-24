'use client';
import { Button, ErrorState, Icon, Skeleton } from '@house/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { startTotpSetup, type TotpSetup, type TotpVerifyResult } from '../../api';
import { groupSecret } from '../../lib/otp';
import { mustRestartLogin } from '../../lib/session';
import styles from './login.module.css';
import { QrCode } from './QrCode';
import { TotpCodeForm } from './TotpStep';

export interface TotpEnrollProps {
  onVerified: (result: TotpVerifyResult) => void;
  onSessionLost?: (message: string) => void;
  submitLabel?: string;
}

type SetupState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; setup: TotpSetup };

/**
 * Authenticator enrolment: POST /admin/auth/totp/setup → QR (rendered locally from the otpauth URI)
 * + manual key → confirm with a first code.
 */
export function TotpEnroll({
  onVerified,
  onSessionLost,
  submitLabel = '등록 완료',
}: TotpEnrollProps) {
  const [state, setState] = useState<SetupState>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  // Every setup call issues a new secret server-side; only the latest response may be shown,
  // otherwise the QR could carry a secret the API already replaced (StrictMode double effects,
  // a fast "다시 시도").
  const latest = useRef(0);

  const load = useCallback(async () => {
    const call = ++latest.current;
    setState({ status: 'loading' });
    try {
      const setup = await startTotpSetup();
      if (call === latest.current) setState({ status: 'ready', setup });
    } catch (e) {
      if (call !== latest.current) return;
      if (mustRestartLogin(e) && onSessionLost) onSessionLost(errorMessage(e));
      else setState({ status: 'error', message: errorMessage(e) });
    }
  }, [onSessionLost]);

  useEffect(() => {
    void load();
    return () => {
      latest.current += 1; // unmounted (or effect re-run): drop the pending response
    };
  }, [load]);

  if (state.status === 'error')
    return (
      <ErrorState
        compact
        title="등록 정보를 불러오지 못했어요"
        description={state.message}
        onRetry={() => void load()}
      />
    );

  const setup = state.status === 'ready' ? state.setup : null;
  const copy = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ol className={styles.enroll}>
      <li className={styles.enrollStep}>
        <b>인증 앱 준비</b>
        <p>휴대폰에 Google Authenticator, Microsoft Authenticator 같은 OTP 앱을 설치하세요.</p>
      </li>
      <li className={styles.enrollStep}>
        <b>QR 코드 스캔</b>
        <p>
          앱에서 계정 추가 → QR 코드 스캔을 선택하세요. 스캔이 어렵다면 설정 키를 직접 입력해도
          됩니다.
        </p>
        {setup ? (
          <div className={styles.qrRow}>
            <span className={styles.qr}>
              <QrCode value={setup.otpauthUrl} label="인증 앱 등록용 QR 코드" />
            </span>
            <div className={styles.qrSide}>
              <span>설정 키 (직접 입력용)</span>
              <code className={styles.secret}>{groupSecret(setup.secret)}</code>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Icon name={copied ? 'check' : 'copy'} size={16} />}
                onClick={() => void copy()}
              >
                {copied ? '복사했어요' : '키 복사'}
              </Button>
              {/* Phones: the authenticator usually lives on this very device, where a QR cannot be
                  scanned — the otpauth:// link hands the account to the app directly. */}
              <Button
                variant="soft"
                size="sm"
                href={setup.otpauthUrl}
                className={styles.openApp}
                iconLeft={<Icon name="external-link" size={16} />}
              >
                이 휴대폰의 인증 앱에 추가
              </Button>
              <span className="sr-only" aria-live="polite">
                {copied ? '설정 키를 복사했습니다.' : ''}
              </span>
            </div>
          </div>
        ) : (
          <Skeleton height={176} radius={16} className={styles.qrSkeleton} />
        )}
      </li>
      <li className={styles.enrollStep}>
        <b>코드 확인</b>
        <p>앱에 표시된 6자리 코드를 입력하면 등록이 끝납니다.</p>
        <div style={{ marginTop: 12 }}>
          <TotpCodeForm
            submitLabel={submitLabel}
            onVerified={onVerified}
            onSessionLost={onSessionLost}
            autoFocus={false}
          />
        </div>
      </li>
    </ol>
  );
}
