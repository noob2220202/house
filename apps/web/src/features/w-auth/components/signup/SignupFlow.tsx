'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AUTH_PROVIDER_LABEL, type AuthProvider } from '@house/shared';
import { Button, Icon, Input, ProviderTile, useToast } from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/lib/auth/session';
import type { SessionUser } from '@/lib/auth/types';
import { authKeys, completeSignup, fetchPendingSignup, saveInterestRegions } from '../../api';
import { buildSignupPayload, countTerms, missingRequired, sortTerms } from '../../lib/consents';
import type { ConsentState } from '../../lib/consents';
import {
  loginPath,
  parseSignupReturnTo,
  resolvePostLoginTarget,
  type LoginIntent,
} from '../../lib/flow';
import {
  clearLoginContext,
  loginContextSnapshot,
  parseLoginContext,
} from '../../lib/login-context';
import { maskEmail, maskName } from '../../lib/mask';
import { oauthErrorInfo } from '../../lib/oauth-errors';
import { writeRecentProvider } from '../../lib/recent-provider';
import { prefillNickname, signupFormSchema, type SignupFormValues } from '../../lib/signup-schema';
import { CallbackError } from '../callback/CallbackError';
import { AgentNextCard } from './AgentNextCard';
import { RegionCount, RegionPicker } from './RegionPicker';
import { SignupDone } from './SignupDone';
import { SignupSteps } from './SignupSteps';
import { AGE_INPUT_ID, TermsAgreement, consentInputId } from './TermsAgreement';
import styles from './signup.module.css';

const FORM_ID = 'signup-form';
const subscribeNever = () => () => undefined;
const MISSING_MESSAGE = '필수 항목에 모두 동의해야 가입할 수 있어요.';

/** Errors after which the form cannot help any more: the page shows a notice card instead. */
const BLOCKING_CODES = new Set(['AUTH_SIGNUP_EXPIRED', 'AUTH_REJOIN_COOLDOWN', 'UNAUTHENTICATED']);

export interface SignupFlowProps {
  /** `?provider=` of the backend redirect — shown until the pending signup has loaded. */
  provider?: AuthProvider;
  /** Member type from the URL (`?intent=agent`), when the visitor did not start on /login here. */
  intent: LoginIntent;
}

interface Done {
  nickname: string;
  regionKeys: string[];
  intent: LoginIntent;
  target: string;
}

/**
 * Signup of a first-time social login (step 2 → 3). The backend redirected here with a pending
 * signup cookie and no session: GET /auth/signup gives the provider profile and the current terms,
 * POST /auth/signup `{ nickname, ageOver14, consents, marketingOptIn }` creates the member and the
 * session, then the optional 관심 지역 are saved with the new session.
 */
export function SignupFlow({ provider: providerHint, intent: intentHint }: SignupFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const pending = useQuery({
    queryKey: authKeys.pendingSignup(),
    queryFn: ({ signal }) => fetchPendingSignup(signal),
    retry: false,
    staleTime: Infinity,
  });
  const docs = useMemo(
    () => (pending.data ? sortTerms(pending.data.terms) : undefined),
    [pending.data],
  );

  // What the visitor chose on /login in this tab (member type, destination) — read after hydration
  // (server snapshot = none).
  const rawContext = useSyncExternalStore(subscribeNever, loginContextSnapshot, () => null);
  const context = useMemo(() => parseLoginContext(rawContext), [rawContext]);
  const intent: LoginIntent = context?.intent ?? intentHint;

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: 'onBlur',
    defaultValues: { nickname: '' },
  });
  const prefill = pending.data?.prefill;
  useEffect(() => {
    if (prefill && !form.formState.isDirty)
      form.reset({ nickname: prefillNickname(prefill.nickname) });
  }, [prefill, form]);

  const [consents, setConsents] = useState<ConsentState>({});
  const [ageOver14, setAgeOver14] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [regionKeys, setRegionKeys] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState<'full' | 'skip' | null>(null);
  const [blockedCode, setBlockedCode] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  // Move focus to the heading when the completion step replaces the form.
  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  const complete = (next: ConsentState, age: boolean) =>
    age && docs !== undefined && missingRequired(docs, next).length === 0;
  const changeConsents = (next: ConsentState) => {
    setConsents(next);
    if (consentError && complete(next, ageOver14)) setConsentError(null);
  };
  const changeAge = (checked: boolean) => {
    setAgeOver14(checked);
    if (consentError && complete(consents, checked)) setConsentError(null);
  };

  const finish = async (user: SessionUser, returnTo: string | null | undefined, keys: string[]) => {
    queryClient.setQueryData<SessionUser | null>(SESSION_QUERY_KEY, user);
    if (pending.data) writeRecentProvider(pending.data.provider);
    clearLoginContext();
    // Interest regions are optional — nothing is sent when none were chosen ("나중에 선택"), and a
    // failure here must not undo the signup.
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
    const stored = returnTo ? parseSignupReturnTo(returnTo) : null;
    const flow = stored ?? { next: context?.next ?? '', intent };
    setDone({
      nickname: user.nickname,
      regionKeys: keys,
      intent: flow.intent,
      target: resolvePostLoginTarget({ next: flow.next, intent: flow.intent, user }),
    });
    window.scrollTo({ top: 0 });
  };

  const fail = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      toast({ message: errorMessage(error), tone: 'error' });
      return;
    }
    if (BLOCKING_CODES.has(error.code) || error.isUnauthenticated) {
      setBlockedCode(error.isUnauthenticated ? 'AUTH_SIGNUP_EXPIRED' : error.code);
    } else if (error.code === 'AUTH_TERMS_INVALID') {
      // A new version took effect while the form was open: show it and ask again.
      setConsents({});
      setConsentError('약관이 방금 바뀌었어요. 바뀐 약관을 확인하고 다시 동의해 주세요.');
      void pending.refetch();
    } else if (
      error.code === 'AUTH_TERMS_REQUIRED' ||
      error.code === 'AUTH_REQUIRED_TERMS_REVOKE'
    ) {
      setConsentError(MISSING_MESSAGE);
    } else if (error.isValidation && error.fieldErrors().nickname) {
      form.setError('nickname', { message: error.fieldErrors().nickname }, { shouldFocus: true });
    } else if (error.isValidation && error.fieldErrors().ageOver14) {
      setConsentError(MISSING_MESSAGE);
    } else {
      toast({ message: error.message, tone: 'error' });
    }
  };

  const submit = (skipRegions: boolean) =>
    form.handleSubmit(
      async ({ nickname }) => {
        if (!docs) return;
        const missing = missingRequired(docs, consents);
        if (!ageOver14 || missing.length > 0) {
          setConsentError(MISSING_MESSAGE);
          document
            .getElementById(!ageOver14 ? AGE_INPUT_ID : consentInputId(missing[0]!.type))
            ?.focus();
          return;
        }
        setSubmitting(skipRegions ? 'skip' : 'full');
        try {
          const result = await completeSignup(buildSignupPayload(docs, consents, nickname));
          await finish(result.user, result.returnTo, skipRegions ? [] : regionKeys);
        } catch (error) {
          fail(error);
        } finally {
          setSubmitting(null);
        }
      },
      () => {
        if (docs && (!ageOver14 || missingRequired(docs, consents).length > 0))
          setConsentError(MISSING_MESSAGE);
      },
    );

  // No live pending signup (expired, opened directly, already used) or a refusal that retrying the
  // form cannot fix: explain and send the visitor back to the social login.
  const loadBlocked =
    pending.error instanceof ApiError && pending.error.isUnauthenticated
      ? 'AUTH_SIGNUP_EXPIRED'
      : null;
  const blocked = done ? null : (blockedCode ?? loadBlocked);
  if (blocked) {
    return (
      <CallbackError
        info={oauthErrorInfo(blocked)}
        provider={pending.data?.provider ?? providerHint}
        retryHref={loginPath({ returnTo: context?.next, intent })}
      />
    );
  }

  const provider = pending.data?.provider ?? providerHint;
  const counts = docs ? countTerms(docs) : null;
  const who = [maskName(prefill?.name), maskEmail(prefill?.email)].filter(Boolean);
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
            intent={done.intent}
            target={done.target}
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
                      필수 {counts.required + 1}개 · 선택 {counts.optional}개
                    </span>
                  )}
                </div>
                <TermsAgreement
                  docs={docs}
                  loading={pending.isPending}
                  loadError={pending.isError && !docs ? errorMessage(pending.error) : null}
                  onRetry={() => void pending.refetch()}
                  value={consents}
                  onChange={changeConsents}
                  age={{ checked: ageOver14, onChange: changeAge }}
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
                    help="문의나 요청을 남길 때 중개사무소에 보이는 이름이에요. 띄어쓰기 없이 써 주세요."
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
