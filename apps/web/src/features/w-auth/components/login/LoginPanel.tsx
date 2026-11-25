'use client';
import { AUTH_PROVIDER_SLUG, AuthProvider } from '@house/shared';
import { Callout, Icon, SegmentedControl, SocialButton, type SocialProvider } from '@house/ui';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { ROUTES } from '@/config/nav';
import { PROVIDERS, loginPath, oauthLoginUrl, type LoginIntent } from '../../lib/flow';
import { rememberLoginContext } from '../../lib/login-context';
import { readRecentProvider } from '../../lib/recent-provider';
import styles from './login.module.css';

const LABEL: Record<AuthProvider, string> = {
  KAKAO: '카카오로 시작하기',
  NAVER: '네이버로 시작하기',
  GOOGLE: 'Google로 계속하기',
};

const INTENTS = [
  { value: 'user', label: '일반 회원' },
  { value: 'agent', label: '중개사 회원' },
] as const;

const subscribeNever = () => () => undefined;

export interface LoginNotice {
  tone: 'error' | 'info';
  message: string;
}

export interface LoginPanelProps {
  /** Validated site-relative target after login (undefined = home). */
  returnTo?: string;
  initialIntent: LoginIntent;
  /** Message above the buttons (expired session, failed attempt …). */
  notice?: LoginNotice;
  /** API mock mode: shows the dev helper and asks the mock for first-visit signup behaviour. */
  mock?: boolean;
}

/** Right half of the split login: member type, 카카오 / 네이버 / Google buttons (no other method exists). */
export function LoginPanel({ returnTo, initialIntent, notice, mock }: LoginPanelProps) {
  const [intent, setIntent] = useState<LoginIntent>(initialIntent);
  // localStorage is read after hydration only (server snapshot = no hint).
  const recent = useSyncExternalStore(subscribeNever, readRecentProvider, () => null);

  const changeIntent = (next: LoginIntent) => {
    setIntent(next);
    // Keep the choice in the URL (shareable, survives reload) without a navigation.
    window.history.replaceState(null, '', loginPath({ returnTo, intent: next }));
  };
  const startUrl = (provider: AuthProvider, as?: string) => {
    const url = oauthLoginUrl(provider, { returnTo, intent });
    return mock ? `${url}&as=${as ?? 'auto'}` : url;
  };
  const agent = intent === 'agent';

  return (
    <div className={styles.main}>
      <div className={styles.mainTop}>
        <Link className={styles.back} href={ROUTES.home}>
          <Icon name="chevron-left" size={18} />
          홈으로
        </Link>
        <p className="t-sm">
          {agent ? '매물을 찾고 계신가요?' : '공인중개사이신가요?'}
          <button
            type="button"
            className={`link ${styles.topLink}`}
            onClick={() => changeIntent(agent ? 'user' : 'agent')}
          >
            {agent ? '일반 회원 로그인' : '중개사 회원 가입'}
          </button>
        </p>
      </div>

      <div className={styles.center}>
        <div className={styles.card}>
          <SegmentedControl
            label="회원 유형"
            className={styles.segFull}
            options={INTENTS}
            value={intent}
            onChange={changeIntent}
          />
          <p className={styles.roleNote} aria-live="polite">
            <Icon name="shield" size={16} />
            {agent ? (
              <span>
                로그인하면 <b>중개사무소 인증 신청</b>으로 이어져요. 개설등록번호와 사업자등록증을
                준비해 주세요.
              </span>
            ) : (
              <span>
                중개사 회원은 <b>중개사무소 등록번호 인증</b> 후 매물 등록과 광고 신청을 할 수
                있어요.
              </span>
            )}
          </p>

          <div className={styles.head}>
            <h1 className="t-h1">{agent ? '중개사 회원 로그인' : '로그인'}</h1>
            <p className="t-sm">자주 쓰는 계정으로 간편하게 시작하세요</p>
          </div>

          {notice && (
            <Callout tone={notice.tone === 'error' ? 'danger' : 'info'} icon="info" size="sm" live>
              {notice.message}
            </Callout>
          )}

          {/* A first-time member comes back on /signup without this context: keep it for the tab. */}
          <div
            className={styles.sns}
            onClickCapture={() => rememberLoginContext({ intent, next: returnTo ?? '' })}
          >
            {PROVIDERS.map((provider) => (
              <SocialButton
                key={provider}
                provider={AUTH_PROVIDER_SLUG[provider] as SocialProvider}
                href={startUrl(provider)}
              >
                {LABEL[provider]}
                {recent === provider && (
                  <>
                    {' '}
                    <span className={styles.recent}>최근 사용</span>
                  </>
                )}
              </SocialButton>
            ))}
          </div>

          <ul className={styles.safe}>
            <li>
              <Icon name="lock" size={16} />
              비밀번호를 따로 만들거나 저장하지 않아요.
            </li>
            <li>
              <Icon name="check-circle" size={16} />
              휴대폰 본인 인증 없이 간편 로그인만으로 가입돼요.
            </li>
          </ul>

          <p className={styles.join}>
            로그인에 문제가 있나요?
            <Link className="link" href={ROUTES.support}>
              고객센터
            </Link>
          </p>
        </div>
        <p className={styles.footNote}>
          간편 로그인으로 처음 오시면 약관 동의와 관심 지역 선택 후 가입이 끝나요.
        </p>

        {mock && (
          <p className={styles.mock}>
            <b>MOCK</b>
            <a href={startUrl(AuthProvider.KAKAO, 'new')}>신규 가입</a>
            <a href={startUrl(AuthProvider.KAKAO, 'user')}>일반 회원</a>
            <a href={startUrl(AuthProvider.NAVER, 'agent')}>소속 중개사</a>
            <a href={startUrl(AuthProvider.GOOGLE, 'owner')}>대표 중개사</a>
            <a href={startUrl(AuthProvider.KAKAO, 'reconsent')}>약관 재동의</a>
            <a href={startUrl(AuthProvider.KAKAO, 'suspended')}>정지 계정</a>
            <a
              href={`${oauthLoginUrl(AuthProvider.KAKAO, { returnTo, intent })}&fail=access_denied`}
            >
              취소
            </a>
            <a
              href={`${oauthLoginUrl(AuthProvider.NAVER, { returnTo, intent })}&fail=AUTH_OAUTH_STATE_INVALID`}
            >
              만료
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
