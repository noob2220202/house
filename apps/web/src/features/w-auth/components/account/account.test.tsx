import { AuthProvider, TermsType, UserRole } from '@house/shared';
import { ToastProvider } from '@house/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import type { Identity } from '../../api';
import { WithdrawForm } from '../withdraw/WithdrawForm';
import { ConsentHistoryPanel } from './ConsentHistoryPanel';
import { LinkedAccountsPanel } from './LinkedAccountsPanel';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const calls = vi.hoisted(() => ({
  fetchIdentities: vi.fn(),
  unlinkIdentity: vi.fn(),
  withdrawAccount: vi.fn(),
  fetchConsents: vi.fn(),
  fetchTermsDocument: vi.fn(),
  fetchTermsVersion: vi.fn(),
}));
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  fetchIdentities: calls.fetchIdentities,
  unlinkIdentity: calls.unlinkIdentity,
  withdrawAccount: calls.withdrawAccount,
  fetchConsents: calls.fetchConsents,
  fetchTermsDocument: calls.fetchTermsDocument,
  fetchTermsVersion: calls.fetchTermsVersion,
}));

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

const identity = (provider: AuthProvider, email: string): Identity => ({
  id: `id-${provider}`,
  provider,
  email,
  createdAt: '2026-10-18T09:00:00+09:00',
  lastUsedAt: null,
});
const KAKAO = identity(AuthProvider.KAKAO, 'haneul@example.com');
const NAVER = identity(AuthProvider.NAVER, 'haneul@example.net');

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockReset();
});

describe('<LinkedAccountsPanel>', () => {
  it('lists 카카오 / 네이버 / Google and never shows the full e-mail', async () => {
    calls.fetchIdentities.mockResolvedValue([KAKAO, NAVER]);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByRole('button', { name: '카카오 계정 연결 해제' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '네이버 계정 연결 해제' })).toBeEnabled();
    // Not linked yet → a full-page link to the provider (never a fetch), back to the settings page.
    const link = screen.getByRole('link', { name: 'Google 계정 연결하기' });
    const href = new URL(link.getAttribute('href') ?? '', 'http://localhost');
    expect(href.pathname).toMatch(/\/auth\/oauth\/google\/start$/);
    expect(href.searchParams.get('returnTo')).toBe('/me/account?linked=google');

    expect(screen.getByText('ha***@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/haneul@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();
  });

  it('keeps the last login method: unlink is disabled with an explanation', async () => {
    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByRole('button', { name: '카카오 계정 연결 해제' })).toBeDisabled();
    expect(screen.getByText(/유일한 로그인 수단이에요/)).toBeInTheDocument();
  });

  it('unlinks only after the confirmation', async () => {
    const user = userEvent.setup();
    calls.fetchIdentities.mockResolvedValue([KAKAO, NAVER]);
    calls.unlinkIdentity.mockResolvedValue(undefined);
    renderWithProviders(<LinkedAccountsPanel />);

    await user.click(await screen.findByRole('button', { name: '네이버 계정 연결 해제' }));
    expect(calls.unlinkIdentity).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('네이버 계정 연결을 해제할까요?')).toBeInTheDocument();

    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    await user.click(within(dialog).getByRole('button', { name: '연결 해제' }));
    expect(calls.unlinkIdentity).toHaveBeenCalledWith(AuthProvider.NAVER);
    expect(await screen.findByRole('link', { name: '네이버 계정 연결하기' })).toBeInTheDocument();
    expect(screen.getByText('네이버 계정 연결을 해제했어요.')).toBeInTheDocument();
  });

  it('confirms a link round trip only when the provider really is linked', async () => {
    window.history.replaceState(null, '', '/me/account?linked=google&tab=1');
    calls.fetchIdentities.mockResolvedValue([KAKAO, identity(AuthProvider.GOOGLE, 'g@x.com')]);
    const first = renderWithProviders(<LinkedAccountsPanel />);
    expect(await screen.findByText('Google 계정을 연결했어요.')).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=1');
    first.unmount();

    // A crafted ?linked= without the identity says nothing.
    window.history.replaceState(null, '', '/me/account?linked=naver');
    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel />);
    expect(await screen.findByRole('link', { name: '네이버 계정 연결하기' })).toBeInTheDocument();
    expect(screen.queryByText('네이버 계정을 연결했어요.')).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('shows an error state with a retry', async () => {
    const user = userEvent.setup();
    calls.fetchIdentities.mockRejectedValueOnce(
      new ApiError(500, { code: 'INTERNAL_ERROR', message: '일시적인 오류가 발생했습니다.' }),
    );
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByText('연결된 계정을 불러오지 못했어요')).toBeInTheDocument();
    calls.fetchIdentities.mockResolvedValue([KAKAO, NAVER]);
    await user.click(screen.getByRole('button', { name: /다시 시도/ }));
    expect(
      await screen.findByRole('button', { name: '카카오 계정 연결 해제' }),
    ).toBeInTheDocument();
  });
});

describe('<ConsentHistoryPanel>', () => {
  it('opens the version the user agreed to, not the current one', async () => {
    const user = userEvent.setup();
    calls.fetchConsents.mockResolvedValue([
      {
        termsDocumentId: 'doc-privacy-1.0',
        type: TermsType.PRIVACY,
        version: '1.0',
        title: '개인정보 수집·이용',
        isRequired: true,
        agreed: true,
        createdAt: '2026-09-01T09:00:00+09:00',
      },
    ]);
    calls.fetchTermsVersion.mockResolvedValue({
      id: 'doc-privacy-1.0',
      type: TermsType.PRIVACY,
      version: '1.0',
      title: '개인정보 수집·이용',
      effectiveAt: '2026-08-01T00:00:00+09:00',
      content: '제1조 (수집 항목)\n이름, 연락처',
    });
    renderWithProviders(<ConsentHistoryPanel />);

    await user.click(await screen.findByRole('button', { name: '개인정보 수집·이용 전문 보기' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('버전 1.0')).toBeInTheDocument();
    expect(await within(dialog).findByText(/이름, 연락처/)).toBeInTheDocument();
    expect(calls.fetchTermsVersion).toHaveBeenCalledWith(
      TermsType.PRIVACY,
      '1.0',
      expect.anything(),
    );
    expect(calls.fetchTermsDocument).not.toHaveBeenCalled();
  });
});

describe('<WithdrawForm>', () => {
  const member = { nickname: '순천살이', role: UserRole.USER, email: 'haneul@example.com' };

  it('asks for the explicit consent before anything is sent', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WithdrawForm user={member} />);

    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));
    expect(await screen.findByText('안내 사항을 확인하고 동의해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.withdrawAccount).not.toHaveBeenCalled();
  });

  it('sends the reason only after the final confirmation', async () => {
    const user = userEvent.setup();
    // Never settles: the success path leaves the page with a full navigation.
    calls.withdrawAccount.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<WithdrawForm user={member} />);

    await user.click(screen.getByRole('radio', { name: '이미 집을 구했어요' }));
    await user.type(screen.getByLabelText('더 하고 싶은 말씀'), '신대지구에 구했어요');
    await user.click(screen.getByRole('checkbox', { name: /회원 탈퇴에 동의해요/ }));
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('정말 탈퇴할까요?')).toBeInTheDocument();
    expect(calls.withdrawAccount).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: '탈퇴하기' }));
    expect(calls.withdrawAccount).toHaveBeenCalledWith({
      reason: '이미 집을 구했어요 — 신대지구에 구했어요',
    });
  });

  it('shows the server message when the API refuses (409)', async () => {
    const user = userEvent.setup();
    calls.withdrawAccount.mockRejectedValue(
      new ApiError(409, {
        code: 'AUTH_WITHDRAW_BLOCKED',
        message: '진행 중인 요청을 먼저 마감해 주세요.',
      }),
    );
    renderWithProviders(<WithdrawForm user={member} />);

    await user.click(screen.getByRole('checkbox', { name: /회원 탈퇴에 동의해요/ }));
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '탈퇴하기' }),
    );

    expect(await screen.findByText('지금은 탈퇴할 수 없어요')).toBeInTheDocument();
    expect(screen.getByText(/진행 중인 요청을 먼저 마감해 주세요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '탈퇴하기' })).toBeDisabled();
  });

  it('blocks an agency owner up front and points to the broker console', () => {
    renderWithProviders(
      <WithdrawForm user={{ ...member, nickname: '신대중앙', role: UserRole.AGENCY_OWNER }} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('지금은 탈퇴할 수 없어요');
    expect(screen.getByRole('link', { name: '중개사 콘솔로 가기' })).toHaveAttribute(
      'href',
      '/agent',
    );
    expect(screen.getByRole('button', { name: '탈퇴하기' })).toBeDisabled();
    // The notice comes first (above the fold) and the form it cannot use is not shown.
    expect(
      screen
        .getByRole('alert')
        .compareDocumentPosition(
          screen.getByRole('heading', { name: '탈퇴 전에 꼭 확인해 주세요' }),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.queryByRole('checkbox', { name: /회원 탈퇴에 동의해요/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('tells a staff agent that they leave their office', () => {
    renderWithProviders(<WithdrawForm user={{ ...member, role: UserRole.AGENT }} />);
    expect(screen.getByText('소속 중개사무소에서 제외돼요')).toBeInTheDocument();
  });
});
