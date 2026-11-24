'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AUTH_PROVIDER_LABEL, TermsType, type AuthProvider } from '@house/shared';
import { Button, Icon, Input, ProviderTile, useToast } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import {
  authKeys,
  fetchTerms,
  saveInterestRegions,
  submitConsents,
  updateProfile,
  type TermsDocument,
} from '../../api';
import {
  buildConsentPayload,
  countTerms,
  missingRequired,
  sortTerms,
  type ConsentState,
} from '../../lib/consents';
import type { LoginIntent } from '../../lib/flow';
import { maskEmail, maskName } from '../../lib/mask';
import { signupFormSchema, type SignupFormValues } from '../../lib/signup-schema';
import { AgentNextCard } from './AgentNextCard';
import { RegionCount, RegionPicker } from './RegionPicker';
import { SignupDone } from './SignupDone';
import { SignupSteps } from './SignupSteps';
import { TermsAgreement, consentInputId } from './TermsAgreement';
import styles from './signup.module.css';

const FORM_ID = 'signup-form';

export interface SignupFlowProps {
  /** Profile prefilled from the social account. */
  account: { nickname: string; name?: string | null; email?: string | null };
  provider?: AuthProvider;
  intent: LoginIntent;
  /** Destination after signup (validated on the server). */
  target: string;
  /** Terms fetched on the server; null when that failed (the client retries). */
  initialTerms: TermsDocument[] | null;
}

/** Signup completion (step 2 → 3): terms consents with versions, nickname and 관심 지역. */
export function SignupFlow({ account, provider, intent, target, initialTerms }: SignupFlowProps) {
  const { toast } = useToast();
  const { refresh } = useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const termsQuery = useQuery({
    queryKey: authKeys.terms(),
    queryFn: ({ signal }) => fetchTerms(signal),
    initialData: initialTerms ?? undefined,
    staleTime: 5 * 60_000,
  });
  const docs = useMemo(
    () => (termsQuery.data ? sortTerms(termsQuery.data) : undefined),
    [termsQuery.data],
  );

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: 'onBlur',
    defaultValues: { nickname: account.nickname },
  });
  const [consents, setConsents] = useState<ConsentState>({});
  const [consentError, setConsentError] = useState<string | null>(null);
  const [regionKeys, setRegionKeys] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState<'full' | 'skip' | null>(null);
  const [done, setDone] = useState<{ nickname: string; regionKeys: string[] } | null>(null);

  // Move focus to the heading when the completion step replaces the form.
  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  const changeConsents = (next: ConsentState) => {
    setConsents(next);
    if (consentError && docs && missingRequired(docs, next).length === 0) setConsentError(null);
  };

  const submit = (skipRegions: boolean) =>
    form.handleSubmit(
      async ({ nickname }) => {
        if (!docs) return;
        const missing = missingRequired(docs, consents);
        if (missing.length > 0) {
          setConsentError('필수 약관에 모두 동의해야 가입할 수 있어요.');
          document.getElementById(consentInputId(missing[0]!.type))?.focus();
          return;
        }
        const keys = skipRegions ? [] : regionKeys;
        setSubmitting(skipRegions ? 'skip' : 'full');
        try {
          await submitConsents(buildConsentPayload(docs, consents));
          await updateProfile({
            nickname,
            marketingOptIn: consents[TermsType.MARKETING] === true,
          });
        } catch (error) {
          setSubmitting(null);
          if (error instanceof ApiError && error.code === 'AUTH_TERMS_REQUIRED') {
            setConsentError(error.message);
          } else if (
            error instanceof ApiError &&
            error.isValidation &&
            error.fieldErrors().nickname
          ) {
            form.setError(
              'nickname',
              { message: error.fieldErrors().nickname },
              { shouldFocus: true },
            );
          } else {
            toast({ message: errorMessage(error), tone: 'error' });
          }
          return;
        }
        // Interest regions are optional — nothing is sent when none were chosen ("나중에 선택"), and a
        // failure here must not block the signup.
        if (keys.length > 0) {
          try {
            await saveInterestRegions({ regionKeys: keys, notify });
          } catch {
            toast({
              message: '관심 지역은 저장하지 못했어요. 마이페이지에서 다시 선택해 주세요.',
              tone: 'info',
            });
          }
        }
        await refresh().catch(() => undefined);
        setSubmitting(null);
        setDone({ nickname, regionKeys: keys });
        window.scrollTo({ top: 0 });
      },
      () => {
        if (docs && missingRequired(docs, consents).length > 0)
          setConsentError('필수 약관에 모두 동의해야 가입할 수 있어요.');
      },
    );

  const counts = docs ? countTerms(docs) : null;
  const who = [maskName(account.name), maskEmail(account.email)].filter(Boolean);
  const busy = submitting !== null;

  return (
    <section className={styles.signup} aria-labelledby="signup-h">
      <div className={`container ${styles.in}`}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <p className="eyebrow">회원가입</p>
            <h1 id="signup-h" className="t-h1" ref={headingRef} tabIndex={-1}>
              {done ? '이제 순천의 집을 찾아볼까요?' : '두 가지만 확인하면 가입이 끝나요'}
            </h1>
            <p className={styles.acct}>
              {provider && <ProviderTile provider={provider} size="md" />}
              <span>
                <b>{provider ? `${AUTH_PROVIDER_LABEL[provider]} 계정` : '간편 로그인 계정'}</b>
                으로 {done ? '가입 완료' : '가입 중'}
                {who[0] && ` · ${who[0]}`}
                {who[1] && <span className="only-lg"> · {who[1]}</span>}
              </span>
            </p>
          </div>
          <SignupSteps current={done ? 2 : 1} />
        </div>

        {done ? (
          <SignupDone
            nickname={done.nickname}
            regionKeys={done.regionKeys}
            notify={notify}
            intent={intent}
            target={target}
          />
        ) : (
          <div className={styles.body}>
            <div className={styles.grid}>
              {/* The form is the terms card only — the region search below is a form of its own. */}
              <form
                id={FORM_ID}
                className={styles.card}
                aria-labelledby="su-terms-h"
                noValidate
                onSubmit={(e) => void submit(false)(e)}
              >
                <div className={styles.cardHd}>
                  <h2 id="su-terms-h" className="t-h3">
                    약관 동의
                  </h2>
                  {counts && (
                    <span className="t-cap">
                      필수 {counts.required}개 · 선택 {counts.optional}개
                    </span>
                  )}
                </div>
                <TermsAgreement
                  docs={docs}
                  loading={termsQuery.isPending}
                  loadError={termsQuery.isError && !docs ? errorMessage(termsQuery.error) : null}
                  onRetry={() => void termsQuery.refetch()}
                  value={consents}
                  onChange={changeConsents}
                  error={consentError}
                  disabled={busy}
                />
                <div className={styles.nick}>
                  <Input
                    label="닉네임"
                    required
                    maxLength={20}
                    autoComplete="nickname"
                    placeholder="2~20자, 한글·영문·숫자"
                    help="문의나 요청을 남길 때 중개사무소에 보이는 이름이에요."
                    error={form.formState.errors.nickname?.message}
                    disabled={busy}
                    {...form.register('nickname')}
                  />
                </div>
                <p className={styles.note}>
                  <Icon name="info" size={16} />
                  <span>
                    관심 단지 새 매물 알림은 서비스 알림이라 마케팅 수신과 상관없이 받을 수 있어요.
                  </span>
                </p>
              </form>

              <section className={styles.card} aria-labelledby="su-region-h">
                <div className={styles.cardHd}>
                  <h2 id="su-region-h" className="t-h3">
                    관심 지역
                  </h2>
                  <RegionCount count={regionKeys.length} />
                </div>
                <RegionPicker
                  value={regionKeys}
                  onChange={setRegionKeys}
                  notify={notify}
                  onNotifyChange={setNotify}
                  disabled={busy}
                />
              </section>
            </div>

            <div className={styles.cta}>
              <p className="t-sm">관심 지역과 알림은 마이페이지에서 언제든 바꿀 수 있어요.</p>
              <div className={styles.ctaB}>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  loading={submitting === 'skip'}
                  disabled={busy || !docs}
                  onClick={() => void submit(true)()}
                >
                  나중에 선택
                </Button>
                <Button
                  type="submit"
                  form={FORM_ID}
                  size="lg"
                  loading={submitting === 'full'}
                  disabled={busy || !docs}
                  iconRight={<Icon name="chevron-right" size={18} />}
                >
                  동의하고 가입 완료
                </Button>
              </div>
            </div>

            {intent === 'agent' && <AgentNextCard ready={false} />}
          </div>
        )}
      </div>
    </section>
  );
}
