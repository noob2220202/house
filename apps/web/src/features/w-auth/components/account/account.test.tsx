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

const session = vi.hoisted(() => ({
  user: null as null | { pendingRequiredTerms: string[] },
  requestReconsent: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useSession: () => session }));

const calls = vi.hoisted(() => ({
  fetchIdentities: vi.fn(),
  unlinkIdentity: vi.fn(),
  withdrawAccount: vi.fn(),
  withdrawSuspendedAccount: vi.fn(),
  fetchConsents: vi.fn(),
  fetchTermsDocument: vi.fn(),
  fetchTermsVersion: vi.fn(),
}));
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  fetchIdentities: calls.fetchIdentities,
  unlinkIdentity: calls.unlinkIdentity,
  withdrawAccount: calls.withdrawAccount,
  withdrawSuspendedAccount: calls.withdrawSuspendedAccount,
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
  provider,
  email,
  linkedAt: '2026-10-18T09:00:00+09:00',
  lastUsedAt: null,
});
const KAKAO = identity(AuthProvider.KAKAO, 'haneul@example.com');
const NAVER = identity(AuthProvider.NAVER, 'haneul@example.net');

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockReset();
  session.user = null;
  session.requestReconsent.mockReset();
});

describe('<LinkedAccountsPanel> summary (내 정보)', () => {
  it('shows who is linked and points to 계정 설정 — no link / unlink controls', async () => {
    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel />);

    const list = await screen.findByRole('list');
    await within(list).findByText('연결됨');
    expect(within(list).getAllByText('미연결')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /계정 설정에서 관리/ })).toHaveAttribute(
      'href',
      '/me/account',
    );
    expect(screen.queryByRole('button', { name: /연결 해제/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /계정 연결하기/ })).not.toBeInTheDocument();
  });
});

describe('<LinkedAccountsPanel manage>', () => {
  it('lists 카카오 / 네이버 / Google and never shows the full e-mail', async () => {
    calls.fetchIdentities.mockResolvedValue([KAKAO, NAVER]);
    renderWithProviders(<LinkedAccountsPanel manage />);

    expect(await screen.findByRole('button', { name: '카카오 계정 연결 해제' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '네이버 계정 연결 해제' })).toBeEnabled();
    // Not linked yet → a full-page link to the provider (never a fetch), back to the settings page.
    const link = screen.getByRole('link', { name: 'Google 계정 연결하기' });
    const href = new URL(link.getAttribute('href') ?? '', 'http://localhost');
    expect(href.pathname).toMatch(/\/auth\/oauth\/google\/start$/);
    expect(href.searchParams.get('returnTo')).toBe('/me/account');
    expect(href.searchParams.get('intent')).toBe('link');

    expect(screen.getByText('ha***@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/haneul@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();
  });

  it('keeps the last login method: unlink is disabled with an explanation', async () => {
    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel manage />);

    expect(await screen.findByRole('button', { name: '카카오 계정 연결 해제' })).toBeDisabled();
    expect(screen.getByText(/유일한 로그인 수단이에요/)).toBeInTheDocument();
  });

  it('unlinks only after the confirmation', async () => {
    const user = userEvent.setup();
    calls.fetchIdentities.mockResolvedValue([KAKAO, NAVER]);
    // DELETE answers the remaining identities.
    calls.unlinkIdentity.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel manage />);

    await user.click(await screen.findByRole('button', { name: '네이버 계정 연결 해제' }));
    expect(calls.unlinkIdentity).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('네이버 계정 연결을 해제할까요?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '연결 해제' }));
    expect(calls.unlinkIdentity).toHaveBeenCalledWith(AuthProvider.NAVER);
    expect(await screen.findByRole('link', { name: '네이버 계정 연결하기' })).toBeInTheDocument();
    expect(screen.getByText('네이버 계정 연결을 해제했어요.')).toBeInTheDocument();
  });

  it('confirms a link round trip only when the provider really is linked', async () => {
    window.history.replaceState(null, '', '/me/account?linked=google&tab=1');
    calls.fetchIdentities.mockResolvedValue([KAKAO, identity(AuthProvider.GOOGLE, 'g@x.com')]);
    const first = renderWithProviders(<LinkedAccountsPanel manage />);
    expect(await screen.findByText('Google 계정을 연결했어요.')).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=1');
    first.unmount();

    // A crafted ?linked= without the identity says nothing.
    window.history.replaceState(null, '', '/me/account?linked=naver');
    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel manage />);
    expect(await screen.findByRole('link', { name: '네이버 계정 연결하기' })).toBeInTheDocument();
    expect(screen.queryByText('네이버 계정을 연결했어요.')).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('explains a failed link round trip (?error=) and cleans the URL', async () => {
    window.history.replaceState(null, '', '/me/account?error=AUTH_IDENTITY_DUPLICATE');
    calls.fetchIdentities.mockResolvedValue([KAKAO]);
    renderWithProviders(<LinkedAccountsPanel manage />);
    expect(await screen.findByText('이미 다른 회원에 연결된 계정이에요')).toBeInTheDocument();
    expect(screen.getByText(/AUTH_IDENTITY_DUPLICATE/)).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('shows an error state with a retry', async () => {
    const user = userEvent.setup();
    calls.fetchIdentities.mockRejectedValueOnce(
      new ApiError(500, { code: 'INTERNAL_ERROR', message: '일시적인 오류가 발생했습니다.' }),
    );
    renderWithProviders(<LinkedAccountsPanel manage />);

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
        effectiveAt: '2026-08-01T00:00:00+09:00',
        agreed: true,
        decidedAt: '2026-09-01T09:00:00+09:00',
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

describe('<ConsentHistoryPanel> re-consent', () => {
  it('offers 동의하기 for a pending required document and says when nothing was decided', async () => {
    const user = userEvent.setup();
    session.user = { pendingRequiredTerms: ['PRIVACY'] };
    calls.fetchConsents.mockResolvedValue([
      {
        termsDocumentId: 'doc-privacy-1.2',
        type: TermsType.PRIVACY,
        version: '1.2',
        title: '개인정보 수집·이용',
        isRequired: true,
        effectiveAt: '2026-12-01T00:00:00+09:00',
        agreed: false,
        decidedAt: null,
      },
      {
        termsDocumentId: 'doc-marketing',
        type: TermsType.MARKETING,
        version: '1.0',
        title: '마케팅 정보 수신',
        isRequired: false,
        effectiveAt: '2026-10-01T00:00:00+09:00',
        agreed: false,
        decidedAt: null,
      },
    ]);
    renderWithProviders(<ConsentHistoryPanel />);

    await user.click(await screen.findByRole('button', { name: '동의하기' }));
    expect(session.requestReconsent).toHaveBeenCalled();
    expect(screen.getAllByText(/아직 동의하지 않았어요/)).toHaveLength(2);
    // An optional document is just "미동의".
    expect(screen.getByText('미동의')).toBeInTheDocument();
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
      confirm: true,
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

  it('lets a suspended member withdraw with the ticket (POST /auth/withdraw)', async () => {
    const user = userEvent.setup();
    calls.withdrawSuspendedAccount.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<WithdrawForm mode="suspended" />);

    expect(screen.getByText('이용 정지 기록은 정해진 기간 동안 보관돼요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '취소' })).toHaveAttribute('href', '/');
    await user.click(screen.getByRole('checkbox', { name: /회원 탈퇴에 동의해요/ }));
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '탈퇴하기' }),
    );
    expect(calls.withdrawSuspendedAccount).toHaveBeenCalledWith({ confirm: true });
    expect(calls.withdrawAccount).not.toHaveBeenCalled();
  });

  it('explains an expired withdrawal ticket (401) and points to the login', async () => {
    const user = userEvent.setup();
    calls.withdrawSuspendedAccount.mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }),
    );
    renderWithProviders(<WithdrawForm mode="suspended" />);
    await user.click(screen.getByRole('checkbox', { name: /회원 탈퇴에 동의해요/ }));
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '탈퇴하기' }),
    );
    expect(await screen.findByText(/탈퇴를 진행할 수 있는 시간/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다시 로그인하기' })).toHaveAttribute('href', '/login');
  });

  it('tells a staff agent that they leave their office', () => {
    renderWithProviders(<WithdrawForm user={{ ...member, role: UserRole.AGENT }} />);
    expect(screen.getByText('소속 중개사무소에서 제외돼요')).toBeInTheDocument();
  });
});
