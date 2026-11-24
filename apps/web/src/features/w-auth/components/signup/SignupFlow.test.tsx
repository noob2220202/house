import { AuthProvider, TermsType } from '@house/shared';
import { ToastProvider } from '@house/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/lib/auth/session';
import { sessionUserSchema } from '@/lib/auth/types';
import type { PendingSignup, TermsDocument } from '../../api';
import { SignupFlow } from './SignupFlow';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('./TermsModal', () => ({ TermsModal: () => null }));

const calls = vi.hoisted(() => ({
  fetchPendingSignup: vi.fn(),
  completeSignup: vi.fn(),
  saveInterestRegions: vi.fn(),
}));
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  ...calls,
}));

const doc = (type: TermsType, isRequired: boolean, version = '1.0'): TermsDocument => ({
  id: `doc-${type}`,
  type,
  version,
  title: type,
  isRequired,
  effectiveAt: '2026-10-01T00:00:00+09:00',
});
const PENDING: PendingSignup = {
  provider: AuthProvider.KAKAO,
  prefill: { nickname: '하늘 가득', name: '김하늘', email: 'haneul@example.com', phone: null },
  terms: [
    doc(TermsType.MARKETING, false),
    doc(TermsType.SERVICE, true),
    doc(TermsType.PRIVACY, true, '1.1'),
    doc(TermsType.LOCATION, true),
  ],
};
const USER = sessionUserSchema.parse({ id: 'u1', role: 'USER', nickname: '하늘가득' });

function renderFlow(intent: 'user' | 'agent' = 'user') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SignupFlow provider={AuthProvider.KAKAO} intent={intent} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.scrollTo = vi.fn();
});

describe('<SignupFlow> (POST /auth/signup)', () => {
  it('requires the age confirmation and the required terms, then signs up with them', async () => {
    const user = userEvent.setup();
    calls.fetchPendingSignup.mockResolvedValue(PENDING);
    calls.completeSignup.mockResolvedValue({
      user: USER,
      returnTo: '/auth/callback?next=%2Flisting%2F1&provider=kakao',
      csrfToken: 'csrf',
    });
    const client = renderFlow();

    // Provider nickname prefilled without the space the backend rule refuses.
    expect(await screen.findByDisplayValue('하늘가득')).toHaveAccessibleName(/닉네임/);
    expect(screen.getByText(/카카오 계정/)).toBeInTheDocument();
    expect(screen.getByText(/김\*늘/)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: /동의하고 가입 완료/ });
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('필수 항목에 모두 동의해야');
    expect(calls.completeSignup).not.toHaveBeenCalled();

    // Required terms alone are not enough: the 만 14세 이상 confirmation is required too.
    for (const name of [/이용약관/, /개인정보 수집·이용/, /위치기반서비스/]) {
      await user.click(
        screen.getByRole('checkbox', { name: new RegExp(`\\[필수\\] ${name.source}`) }),
      );
    }
    await user.click(submit);
    expect(calls.completeSignup).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /만 14세 이상이에요/ })).toHaveFocus();

    await user.click(screen.getByRole('checkbox', { name: /만 14세 이상이에요/ }));
    await user.click(submit);
    expect(calls.completeSignup).toHaveBeenCalledWith({
      nickname: '하늘가득',
      ageOver14: true,
      consents: [
        { termsDocumentId: 'doc-SERVICE', agreed: true },
        { termsDocumentId: 'doc-PRIVACY', agreed: true },
        { termsDocumentId: 'doc-LOCATION', agreed: true },
        { termsDocumentId: 'doc-MARKETING', agreed: false },
      ],
      marketingOptIn: false,
    });
    // No region chosen: nothing is sent ("나중에 선택" semantics).
    expect(calls.saveInterestRegions).not.toHaveBeenCalled();

    expect(await screen.findByRole('heading', { name: '가입이 완료됐어요' })).toBeInTheDocument();
    // The destination comes from the returnTo the backend kept with the pending signup.
    expect(screen.getByRole('link', { name: /보던 화면으로 돌아가기/ })).toHaveAttribute(
      'href',
      '/listing/1',
    );
    expect(client.getQueryData(SESSION_QUERY_KEY)).toMatchObject({ id: 'u1' });
    expect(window.localStorage.getItem('house:auth:recent-provider')).toBe(AuthProvider.KAKAO);
  });

  it('sends the marketing opt-in and the chosen regions', async () => {
    const user = userEvent.setup();
    calls.fetchPendingSignup.mockResolvedValue(PENDING);
    calls.completeSignup.mockResolvedValue({ user: USER, returnTo: null, csrfToken: 'csrf' });
    calls.saveInterestRegions.mockResolvedValue({ regionKeys: ['sindae'], notify: true });
    renderFlow();

    await user.click(await screen.findByRole('checkbox', { name: /전체 동의/ }));
    await user.click(screen.getByRole('button', { name: '신대지구' }));
    await user.click(screen.getByRole('button', { name: /동의하고 가입 완료/ }));

    expect(calls.completeSignup).toHaveBeenCalledWith(
      expect.objectContaining({ ageOver14: true, marketingOptIn: true }),
    );
    expect(calls.saveInterestRegions).toHaveBeenCalledWith({
      regionKeys: ['sindae'],
      notify: true,
    });
    expect(await screen.findByRole('link', { name: /홈으로 가기/ })).toHaveAttribute('href', '/');
  });

  it('maps a rejected nickname to the field', async () => {
    const user = userEvent.setup();
    calls.fetchPendingSignup.mockResolvedValue(PENDING);
    calls.completeSignup.mockRejectedValue(
      new ApiError(400, {
        code: 'VALIDATION_FAILED',
        message: '입력값을 확인해 주세요.',
        details: [{ path: 'nickname', code: 'custom', message: '사용할 수 없는 닉네임입니다.' }],
      }),
    );
    renderFlow();
    await user.click(await screen.findByRole('checkbox', { name: /전체 동의/ }));
    await user.click(screen.getByRole('button', { name: /동의하고 가입 완료/ }));
    expect(await screen.findByText('사용할 수 없는 닉네임입니다.')).toBeInTheDocument();
  });

  it('explains an expired pending signup and sends the visitor back to the login', async () => {
    calls.fetchPendingSignup.mockRejectedValue(
      new ApiError(401, { code: 'AUTH_SIGNUP_EXPIRED', message: '가입 시간이 만료되었습니다.' }),
    );
    renderFlow();
    expect(
      await screen.findByRole('heading', { name: '가입 시간이 지났어요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute('href', '/login');
  });

  it('stops at a rejoin cooldown', async () => {
    const user = userEvent.setup();
    calls.fetchPendingSignup.mockResolvedValue(PENDING);
    calls.completeSignup.mockRejectedValue(
      new ApiError(403, { code: 'AUTH_REJOIN_COOLDOWN', message: '탈퇴 후 30일 동안은…' }),
    );
    renderFlow();
    await user.click(await screen.findByRole('checkbox', { name: /전체 동의/ }));
    await user.click(screen.getByRole('button', { name: /동의하고 가입 완료/ }));
    expect(
      await screen.findByRole('heading', { name: '지금은 다시 가입할 수 없어요' }),
    ).toBeInTheDocument();
  });

  it('shows the 중개사 step for a member who chose 중개사 회원 on /login', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(
      'house:auth:login-context',
      JSON.stringify({ intent: 'agent', next: '' }),
    );
    calls.fetchPendingSignup.mockResolvedValue(PENDING);
    calls.completeSignup.mockResolvedValue({
      user: USER,
      returnTo: '/auth/callback?provider=kakao&intent=agent',
      csrfToken: 'csrf',
    });
    renderFlow();
    expect(
      await screen.findByRole('heading', { name: '중개사무소 인증 한 단계가 더 있어요' }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: /전체 동의/ }));
    await user.click(screen.getByRole('button', { name: /동의하고 가입 완료/ }));
    const card = await screen.findByRole('region', { name: '중개사무소 인증 한 단계가 더 있어요' });
    expect(within(card).getByRole('link', { name: /중개사무소 인증 시작하기/ })).toHaveAttribute(
      'href',
      '/agent/apply',
    );
    // The login context is spent.
    expect(window.sessionStorage.getItem('house:auth:login-context')).toBeNull();
  });
});
