import { AuthProvider, TermsType } from '@house/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TermsDocument } from '../api';
import type { ConsentState } from '../lib/consents';
import { oauthErrorInfo } from '../lib/oauth-errors';
import { CallbackError } from './callback/CallbackError';
import { LoginPanel } from './login/LoginPanel';
import { RegionCount, RegionPicker } from './signup/RegionPicker';
import { SignupSteps } from './signup/SignupSteps';
import { TermsAgreement } from './signup/TermsAgreement';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The terms modal fetches through TanStack Query — not under test here.
vi.mock('./signup/TermsModal', () => ({ TermsModal: () => null }));

const returnToOf = (href: string | null) =>
  new URL(href ?? '', 'http://localhost').searchParams.get('returnTo') ?? '';

describe('<LoginPanel>', () => {
  it('offers 카카오, 네이버 and Google only — no Apple, no password form', () => {
    render(<LoginPanel initialIntent="user" />);
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.includes('/auth/oauth/'));
    expect(links.map((a) => a.getAttribute('href')?.match(/oauth\/(\w+)\/start/)?.[1])).toEqual([
      'kakao',
      'naver',
      'google',
    ]);
    expect(screen.queryByText(/Apple/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/비밀번호/)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sends the destination through the OAuth landing page', () => {
    render(<LoginPanel initialIntent="user" returnTo="/me/favorites" />);
    const kakao = screen.getByRole('link', { name: /카카오로 시작하기/ });
    expect(returnToOf(kakao.getAttribute('href'))).toBe(
      '/auth/callback?next=%2Fme%2Ffavorites&provider=kakao',
    );
  });

  it('switches to 중개사 회원 and carries the intent', async () => {
    const user = userEvent.setup();
    render(<LoginPanel initialIntent="user" />);
    await user.click(screen.getByRole('radio', { name: '중개사 회원' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('중개사 회원 로그인');
    const naver = screen.getByRole('link', { name: /네이버로 시작하기/ });
    expect(returnToOf(naver.getAttribute('href'))).toBe(
      '/auth/callback?provider=naver&intent=agent',
    );
    expect(window.location.search).toBe('?as=agent');
  });

  it('shows the dev helper only in mock mode', () => {
    const { rerender } = render(<LoginPanel initialIntent="user" />);
    expect(screen.queryByText('MOCK')).not.toBeInTheDocument();
    rerender(<LoginPanel initialIntent="user" mock />);
    expect(screen.getByText('MOCK')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Google로 계속하기/ }).getAttribute('href')).toMatch(
      /&as=auto$/,
    );
  });

  it('remembers the member type and destination for a first-time signup', async () => {
    const user = userEvent.setup();
    window.sessionStorage.clear();
    render(<LoginPanel initialIntent="agent" returnTo="/agent/listings" />);
    const kakao = screen.getByRole('link', { name: /카카오로 시작하기/ });
    // jsdom does not navigate; the capture handler runs before the default action.
    kakao.addEventListener('click', (e) => e.preventDefault());
    await user.click(kakao);
    expect(JSON.parse(window.sessionStorage.getItem('house:auth:login-context') ?? '{}')).toEqual({
      intent: 'agent',
      next: '/agent/listings',
    });
  });

  it('marks the provider used last time', () => {
    window.localStorage.setItem('house:auth:recent-provider', AuthProvider.NAVER);
    render(<LoginPanel initialIntent="user" />);
    expect(screen.getByRole('link', { name: /네이버로 시작하기/ })).toHaveTextContent('최근 사용');
    expect(screen.getByRole('link', { name: /카카오로 시작하기/ })).not.toHaveTextContent(
      '최근 사용',
    );
    window.localStorage.clear();
  });
});

describe('<CallbackError>', () => {
  it('explains a cancelled login and offers a retry', () => {
    render(
      <CallbackError
        info={oauthErrorInfo('access_denied')}
        provider={AuthProvider.KAKAO}
        retryHref="/login?returnTo=%2Fme"
      />,
    );
    expect(screen.getByRole('heading', { name: '로그인을 취소했어요' })).toBeInTheDocument();
    expect(screen.getByText('카카오 로그인')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Fme',
    );
    expect(screen.getByText(/ACCESS_DENIED/)).toBeInTheDocument();
  });
  it('sends a failed account link back to the settings, not to the login', () => {
    render(
      <CallbackError
        info={oauthErrorInfo('access_denied', { linking: true })}
        provider={AuthProvider.GOOGLE}
        retryHref="/me/account"
      />,
    );
    expect(screen.getByRole('heading', { name: '계정 연결을 취소했어요' })).toBeInTheDocument();
    expect(screen.getByText('Google 계정 연결')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '계정 설정으로' })).toHaveAttribute(
      'href',
      '/me/account',
    );
    expect(screen.queryByRole('link', { name: '다시 로그인' })).not.toBeInTheDocument();
  });
  it('offers the withdrawal to a suspended member (withdrawable=1)', () => {
    render(
      <CallbackError
        info={oauthErrorInfo('AUTH_ACCOUNT_SUSPENDED', { withdrawable: true })}
        retryHref="/login"
        withdrawHref="/auth/withdraw"
      />,
    );
    expect(screen.getByRole('link', { name: '회원 탈퇴 진행' })).toHaveAttribute(
      'href',
      '/auth/withdraw',
    );
    expect(screen.queryByRole('link', { name: '다시 로그인' })).not.toBeInTheDocument();
  });
  it('does not offer a retry for a suspended account', () => {
    render(<CallbackError info={oauthErrorInfo('AUTH_ACCOUNT_SUSPENDED')} retryHref="/login" />);
    expect(screen.queryByRole('link', { name: '다시 로그인' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '고객센터' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로' })).toBeInTheDocument();
  });
});

const doc = (type: TermsType, isRequired: boolean, version: string): TermsDocument => ({
  id: `doc-${type}`,
  type,
  version,
  title: type,
  isRequired,
  effectiveAt: '2026-10-01T00:00:00+09:00',
});
const DOCS = [
  doc(TermsType.SERVICE, true, '1.0'),
  doc(TermsType.PRIVACY, true, '1.1'),
  doc(TermsType.LOCATION, true, '1.0'),
  doc(TermsType.MARKETING, false, '1.0'),
];

function Terms({ onState }: { onState?: (s: ConsentState) => void }) {
  const [value, setValue] = useState<ConsentState>({});
  return (
    <TermsAgreement
      docs={DOCS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onState?.(next);
      }}
    />
  );
}

describe('<TermsAgreement>', () => {
  it('lists the required and optional documents with their versions', () => {
    render(<Terms />);
    const group = screen.getByRole('group', { name: '약관별 동의' });
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes).toHaveLength(4);
    expect(boxes.map((b) => b.hasAttribute('required'))).toEqual([true, true, true, false]);
    expect(within(group).getByText('v1.1')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /\[필수\] 개인정보 수집·이용/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /\[선택\] 마케팅 정보 수신/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '위치기반서비스 이용약관 전문 보기' }),
    ).toBeInTheDocument();
  });

  it('전체 동의 checks everything and follows individual changes', async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(<Terms onState={onState} />);
    const all = screen.getByRole('checkbox', { name: /전체 동의/ });
    await user.click(all);
    expect(onState).toHaveBeenLastCalledWith({
      SERVICE: true,
      PRIVACY: true,
      LOCATION: true,
      MARKETING: true,
    });
    expect(all).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /^\[선택\] 마케팅 정보 수신/ }));
    expect(all).not.toBeChecked();
    expect(all).toBePartiallyChecked();
    expect(all).not.toHaveAttribute('aria-checked');
    await user.click(all);
    expect(all).toBeChecked();
  });

  it('adds the 만 14세 이상 confirmation and covers it with 전체 동의', async () => {
    const user = userEvent.setup();
    function WithAge() {
      const [value, setValue] = useState<ConsentState>({});
      const [age, setAge] = useState(false);
      return (
        <>
          <TermsAgreement
            docs={DOCS}
            value={value}
            onChange={setValue}
            age={{ checked: age, onChange: setAge }}
          />
          <output>{age ? 'age-yes' : 'age-no'}</output>
        </>
      );
    }
    render(<WithAge />);
    const ageBox = screen.getByRole('checkbox', { name: /\[필수\] 만 14세 이상이에요/ });
    expect(ageBox).toBeRequired();
    const all = screen.getByRole('checkbox', { name: /전체 동의/ });
    await user.click(all);
    expect(ageBox).toBeChecked();
    expect(screen.getByText('age-yes')).toBeInTheDocument();
    await user.click(ageBox);
    expect(all).toBePartiallyChecked();
  });

  it('shows loading, error and validation states', () => {
    const { rerender } = render(
      <TermsAgreement docs={undefined} loading value={{}} onChange={() => {}} />,
    );
    expect(screen.getByLabelText('약관을 불러오는 중')).toHaveAttribute('aria-busy', 'true');
    const onRetry = vi.fn();
    rerender(
      <TermsAgreement
        docs={undefined}
        loadError="네트워크 오류"
        onRetry={onRetry}
        value={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('약관을 불러오지 못했어요')).toBeInTheDocument();
    screen.getByRole('button', { name: /다시 시도/ }).click();
    expect(onRetry).toHaveBeenCalled();
    rerender(
      <TermsAgreement
        docs={DOCS}
        value={{}}
        onChange={() => {}}
        error="필수 약관에 모두 동의해야 가입할 수 있어요."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('필수 약관에 모두 동의해야');
  });
});

function Regions() {
  const [keys, setKeys] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  return (
    <>
      <RegionCount count={keys.length} />
      <RegionPicker value={keys} onChange={setKeys} notify={notify} onNotifyChange={setNotify} />
    </>
  );
}

describe('<RegionPicker>', () => {
  it('selects up to five regions and explains the limit', async () => {
    const user = userEvent.setup();
    render(<Regions />);
    for (const name of ['신대지구', '선월지구', '연향동', '조례동', '왕지동']) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(screen.getByText('5', { selector: 'b' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '매곡동' }));
    expect(screen.getByRole('button', { name: '매곡동' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/5곳까지 고를 수 있어요/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '신대지구' }));
    expect(screen.getByRole('button', { name: '신대지구' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText(/5곳까지 고를 수 있어요/)).not.toBeInTheDocument();
  });

  it('filters chips by search and shows an empty message', async () => {
    const user = userEvent.setup();
    render(<Regions />);
    const search = screen.getByLabelText('관심 지역 검색');
    await user.type(search, '순천대');
    expect(screen.getByRole('button', { name: '석현동 · 순천대' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신대지구' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, '서울');
    expect(screen.getByText(/해당하는 지역이 없어요/)).toBeInTheDocument();
  });

  it('toggles the new-listing alert switch', async () => {
    const user = userEvent.setup();
    render(<Regions />);
    const sw = screen.getByRole('switch', { name: /새 매물이 오르면 알림 받기/ });
    expect(sw).toBeChecked();
    await user.click(sw);
    expect(sw).not.toBeChecked();
  });
});

describe('<SignupSteps>', () => {
  it('marks done, current and upcoming steps', () => {
    render(<SignupSteps current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('간편 인증 완료');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });
});
