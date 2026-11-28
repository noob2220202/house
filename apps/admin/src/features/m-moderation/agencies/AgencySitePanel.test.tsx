import { ToastProvider } from '@house/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENCY_ID, agenciesDb } from '@/app/mock-api/v1/admin/agencies/_fixtures';
import type { AgencySite, AgencySubscriptions } from '../api/schemas';
import { AgencySitePanel } from './AgencySitePanel';
import { AgencySubscriptionsPanel } from './AgencySubscriptionsPanel';

const api = vi.hoisted(() => ({
  fetchAgencySite: vi.fn(),
  decideAgencySite: vi.fn(),
  fetchAgencySubscriptions: vi.fn(),
  createAgencySubscription: vi.fn(),
  updateAgencySubscription: vi.fn(),
}));
vi.mock('../api/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/queries')>();
  return { ...actual, ...api };
});
const session = vi.hoisted((): { role: 'ADMIN' | 'OPERATOR' } => ({ role: 'ADMIN' }));
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    useAdminSession: () => ({ can: () => session.role === 'ADMIN' }),
  };
});

const agency = agenciesDb().find((a) => a.id === AGENCY_ID.B02)!;

function site(over: Partial<AgencySite> = {}): AgencySite {
  return {
    id: 'site-1',
    agencyId: agency.id,
    status: 'REQUESTED',
    slug: null,
    requestedSlug: 'hosupark',
    color: 'GREEN',
    tagline: '호수공원 앞 아파트·상가 매물',
    url: null,
    httpsReady: false,
    live: false,
    requestedAt: '2026-11-20T01:00:00.000Z',
    decidedAt: null,
    decisionReason: null,
    createdAt: '2026-11-20T01:00:00.000Z',
    updatedAt: '2026-11-20T01:00:00.000Z',
    ...over,
  };
}

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.role = 'ADMIN';
});

describe('<AgencySitePanel>', { timeout: 20_000 }, () => {
  it('shows a request and approves it with a corrected, validated address', async () => {
    api.fetchAgencySite.mockResolvedValue({ site: site() });
    api.decideAgencySite.mockResolvedValue(
      site({ status: 'ACTIVE', slug: 'hosu-lake', url: 'https://hosu-lake.localhost' }),
    );
    const user = userEvent.setup();
    wrap(<AgencySitePanel agency={agency} />);

    expect(await screen.findByText('신청한 주소', {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(screen.getByText(/^hosupark\./)).toBeInTheDocument();
    expect(screen.getByText('초록')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '승인' }));

    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText(/홈페이지 주소/);
    expect(input).toHaveValue('hosupark');
    fireEvent.change(input, { target: { value: 'admin' } });
    expect(
      within(dialog).getByText('쓸 수 없는 주소예요. 다른 주소를 입력해 주세요.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '주소 고쳐서 승인' }));
    expect(api.decideAgencySite).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Hosu-Lake' } });
    await user.click(within(dialog).getByRole('button', { name: '주소 고쳐서 승인' }));
    await waitFor(() =>
      expect(api.decideAgencySite).toHaveBeenCalledWith(agency.id, {
        action: 'APPROVE',
        slug: 'hosu-lake',
      }),
    );
  });

  it('approves the requested address as is (no slug sent)', async () => {
    api.fetchAgencySite.mockResolvedValue({ site: site() });
    api.decideAgencySite.mockResolvedValue(site({ status: 'ACTIVE', slug: 'hosupark' }));
    const user = userEvent.setup();
    wrap(<AgencySitePanel agency={agency} />);
    await user.click(await screen.findByRole('button', { name: '승인' }, { timeout: 5_000 }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }));
    await waitFor(() =>
      expect(api.decideAgencySite).toHaveBeenCalledWith(agency.id, {
        action: 'APPROVE',
        slug: undefined,
      }),
    );
  });

  it('tells why an approved site is not open yet and offers suspension', async () => {
    api.fetchAgencySite.mockResolvedValue({
      site: site({ status: 'ACTIVE', slug: 'hosupark', url: 'https://hosupark.localhost' }),
    });
    wrap(<AgencySitePanel agency={agency} />);
    expect(await screen.findByText('주소 준비 중')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hosupark\./ })).toHaveAttribute(
      'href',
      'https://hosupark.localhost',
    );
    expect(screen.getByRole('button', { name: '홈페이지 정지' })).toBeInTheDocument();
  });

  it('keeps 정지 / 정지 해제 from operators (ADMIN+ in the API) but lets them approve', async () => {
    session.role = 'OPERATOR';
    api.fetchAgencySite.mockResolvedValueOnce({
      site: site({ status: 'ACTIVE', slug: 'hosupark', url: 'https://hosupark.localhost' }),
    });
    const { unmount } = wrap(<AgencySitePanel agency={agency} />);
    expect(await screen.findByText(/홈페이지 정지는 관리자 이상 권한에서/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '홈페이지 정지' })).not.toBeInTheDocument();
    unmount();

    api.fetchAgencySite.mockResolvedValueOnce({
      site: site({ status: 'SUSPENDED', slug: 'hosupark', decisionReason: '허위 광고' }),
    });
    const suspended = wrap(<AgencySitePanel agency={agency} />);
    expect(await screen.findByText(/정지 해제는 관리자 이상 권한에서/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '정지 해제' })).not.toBeInTheDocument();
    suspended.unmount();

    api.fetchAgencySite.mockResolvedValueOnce({ site: site() });
    wrap(<AgencySitePanel agency={agency} />);
    expect(await screen.findByRole('button', { name: '승인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '반려' })).toBeInTheDocument();
  });

  it('explains the empty state and the load error', async () => {
    api.fetchAgencySite.mockResolvedValueOnce({ site: null });
    const { unmount } = wrap(<AgencySitePanel agency={agency} />);
    expect(await screen.findByText(/아직 홈페이지를 신청하지 않았어요/)).toBeInTheDocument();
    unmount();
    api.fetchAgencySite.mockRejectedValueOnce(new Error('down'));
    wrap(<AgencySitePanel agency={agency} />);
    expect(await screen.findByText('홈페이지 정보를 불러오지 못했어요')).toBeInTheDocument();
  });
});

const subscriptions = (over: Partial<AgencySubscriptions> = {}): AgencySubscriptions => ({
  items: [
    {
      id: 'sub-1',
      agencyId: agency.id,
      product: 'SITE',
      startsOn: '2026-11-01',
      endsOn: '2027-10-31',
      amountWon: 0,
      memo: '출시 기념 무료',
      canceledAt: null,
      state: 'ACTIVE',
      createdByName: '한지우',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  current: { SITE: true, PLATFORM: false },
  ...over,
});

describe('<AgencySubscriptionsPanel>', { timeout: 20_000 }, () => {
  it('lists periods and validates a new one with the shared schema', async () => {
    api.fetchAgencySubscriptions.mockResolvedValue(subscriptions());
    api.createAgencySubscription.mockResolvedValue(subscriptions().items[0]);
    const user = userEvent.setup();
    wrap(<AgencySubscriptionsPanel agency={agency} />);

    expect(await screen.findByText('2026.11.01 ~ 2027.10.31 · 무료')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^이용 기간/ })).toBeInTheDocument();
    expect(screen.getByText('이용 기간 없음')).toBeInTheDocument(); // PLATFORM today
    expect(screen.queryByText(/구독/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '이용 기간 기록' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/종료일/), { target: { value: '2020-01-01' } });
    fireEvent.change(within(dialog).getByLabelText(/받은 금액/), { target: { value: '330,000' } });
    await user.click(within(dialog).getByRole('button', { name: '기록하기' }));
    expect(
      within(dialog).getByText('종료일은 시작일과 같거나 그 이후여야 합니다.'),
    ).toBeInTheDocument();
    expect(api.createAgencySubscription).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: '종료일 없음' }));
    await user.click(within(dialog).getByRole('button', { name: '기록하기' }));
    await waitFor(() => expect(api.createAgencySubscription).toHaveBeenCalledTimes(1));
    expect(api.createAgencySubscription.mock.calls[0]![1]).toMatchObject({
      product: 'SITE',
      endsOn: null,
      amountWon: 330_000,
      memo: null,
    });
  });

  it('is read-only for operators', async () => {
    session.role = 'OPERATOR';
    api.fetchAgencySubscriptions.mockResolvedValue(subscriptions());
    wrap(<AgencySubscriptionsPanel agency={agency} />);
    expect(await screen.findByText('출시 기념 무료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이용 기간 기록' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument();
  });
});
