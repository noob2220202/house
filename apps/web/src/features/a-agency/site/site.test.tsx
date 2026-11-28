import { AGENCY_SITE_COLORS, AgencySiteStatus } from '@house/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REJECT_REASON_SAMPLE,
  SUSPEND_REASON_SAMPLE,
  mineSiteResponse,
  newOwnerSiteRow,
  resetSiteState,
  saveOwnerSite,
} from '@/app/mock-api/v1/sites/_state';
import { seedOffice } from '@/app/mock-api/v1/agencies/mine/_fixtures';
import { ApiError } from '@/lib/api';
import type { MyAgency } from '../api/schemas';
import * as api from './api';
import { requestBody, slugCheck, subscriptionNotice } from './lib';
import { myAgencySiteSchema, type MyAgencySite } from './schemas';
import { SiteView } from './SiteView';

const toast = vi.fn<(options: { message: string; tone?: string }) => void>();
vi.mock('@house/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@house/ui')>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const agency = vi.hoisted(() => ({ value: null as MyAgency | null }));
vi.mock('../api/useMyAgency', () => ({
  useMyAgency: () => ({ data: agency.value, isPending: false, error: null, refetch: vi.fn() }),
}));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchMySite: vi.fn(),
  checkSiteSlug: vi.fn(),
  requestSite: vi.fn(),
  updateSite: vi.fn(),
}));
const fetchMySite = vi.mocked(api.fetchMySite);
const checkSiteSlug = vi.mocked(api.checkSiteSlug);
const requestSite = vi.mocked(api.requestSite);
const updateSite = vi.mocked(api.updateSite);

const owner = (): MyAgency => ({ ...seedOffice(), myRole: 'OWNER' });

/** The mock's answer for the console office in a given state (parsed like the client does). */
function mine(patch?: Parameters<typeof newOwnerSiteRow>[0] | null): MyAgencySite {
  resetSiteState();
  if (patch === null) saveOwnerSite(null);
  else if (patch) saveOwnerSite(newOwnerSiteRow(patch));
  return myAgencySiteSchema.parse(mineSiteResponse(seedOffice().id));
}

function mount(data: MyAgencySite, who: MyAgency = owner()) {
  agency.value = who;
  fetchMySite.mockResolvedValue(data);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SiteView />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  toast.mockClear();
  fetchMySite.mockReset();
  checkSiteSlug.mockReset();
  requestSite.mockReset();
  updateSite.mockReset();
});

describe('내 홈페이지 lib', () => {
  it('checks the format locally before asking the server', () => {
    expect(slugCheck('', {})).toEqual({ state: 'idle' });
    expect(slugCheck('ab', {}).state).toBe('invalid');
    expect(slugCheck('Sin dae', {}).state).toBe('invalid');
    expect(slugCheck('admin', {})).toMatchObject({ state: 'invalid' });
    expect(slugCheck('sindae', {}).state).toBe('checking');
    expect(slugCheck('sindae', { own: 'sindae' }).state).toBe('own');
  });

  it('maps the availability answer of exactly the typed slug', () => {
    const ok = { slug: 'sindae', available: true, reason: null };
    expect(slugCheck('SINDAE ', { availability: ok }).state).toBe('available');
    expect(slugCheck('sindae2', { availability: ok }).state).toBe('checking');
    const taken = slugCheck('hosu', {
      availability: { slug: 'hosu', available: false, reason: 'TAKEN' },
    });
    expect(taken.state).toBe('unavailable');
    expect('message' in taken && taken.message).toContain('다른 사무소');
    expect(slugCheck('sindae', { failed: true }).state).toBe('error');
  });

  it('words the 이용료 line by the FEATURES switch', () => {
    expect(subscriptionNotice({ required: false, active: false, endsOn: null }).text).toBe(
      '현재 무료로 제공 중이에요.',
    );
    expect(subscriptionNotice({ required: true, active: true, endsOn: '2027-11-30' }).text).toBe(
      '이용 기간: 2027.11.30까지',
    );
    expect(subscriptionNotice({ required: true, active: false, endsOn: null }).tone).toBe('warn');
  });

  it('normalises the request body (empty tagline → null)', () => {
    expect(requestBody({ slug: ' Sindae ', color: 'GREEN', tagline: '  ' })).toEqual({
      slug: 'sindae',
      color: 'GREEN',
      tagline: null,
    });
  });

  it('parses every mock state like the API answers it', () => {
    for (const status of Object.values(AgencySiteStatus)) {
      expect(mine({ status, slug: 'sindae', requestedSlug: 'sindae' }).site?.status).toBe(status);
    }
    expect(mine(null).site).toBeNull();
  });
});

describe('<SiteView>', () => {
  it('no site yet: request form with live availability, then the request is sent', async () => {
    const user = userEvent.setup();
    checkSiteSlug.mockImplementation((slug) =>
      Promise.resolve({
        slug,
        available: slug !== 'hosu',
        reason: slug === 'hosu' ? 'TAKEN' : null,
      }),
    );
    const requested = mine({
      status: 'REQUESTED',
      requestedSlug: 'sindae-office',
      color: 'TEAL',
    });
    requestSite.mockResolvedValue(requested);
    mount(mine(null));

    const input = await screen.findByRole('textbox', { name: /홈페이지 주소/ });
    expect(screen.getByText('현재 무료로 제공 중이에요.', { exact: false })).toBeInTheDocument();

    await user.type(input, 'hosu');
    expect(await screen.findByText(/이미 다른 사무소가/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '신청하기' }));
    expect(requestSite).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'Sindae-Office');
    expect(await screen.findByText('쓸 수 있는 주소예요.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '청록' }));
    // The preview follows the draft.
    expect(screen.getByLabelText('홈페이지 미리보기')).toHaveTextContent('sindae-office.localhost');

    await user.click(screen.getByRole('button', { name: '신청하기' }));
    await waitFor(() =>
      expect(requestSite).toHaveBeenCalledWith({
        slug: 'sindae-office',
        color: 'TEAL',
        tagline: null,
      }),
    );
    expect(await screen.findByText('신청 중')).toBeInTheDocument();
    expect(String(toast.mock.calls.at(-1)?.[0]?.message)).toContain('신청했어요');
  });

  it('puts a server slug error on the field', async () => {
    const user = userEvent.setup();
    checkSiteSlug.mockImplementation((slug) =>
      Promise.resolve({ slug, available: true, reason: null }),
    );
    requestSite.mockRejectedValue(
      new ApiError(409, {
        code: 'AGENCY_SITE_SLUG_DUPLICATE',
        message: '이미 사용 중인 홈페이지 주소입니다.',
      }),
    );
    mount(mine(null));
    await user.type(await screen.findByRole('textbox', { name: /홈페이지 주소/ }), 'sindae');
    await screen.findByText('쓸 수 있는 주소예요.');
    await user.click(screen.getByRole('button', { name: '신청하기' }));
    expect(await screen.findByText('이미 사용 중인 홈페이지 주소입니다.')).toBeInTheDocument();
  });

  it('REQUESTED: pending card, the request can be edited', async () => {
    const user = userEvent.setup();
    mount(mine({ status: 'REQUESTED', requestedSlug: 'sindae' }));
    expect(await screen.findByText('신청 중')).toBeInTheDocument();
    expect(screen.getByText('신청한 주소').nextElementSibling).toHaveTextContent(
      'sindae.localhost',
    );
    expect(screen.queryByRole('textbox', { name: /홈페이지 주소/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '신청 내용 수정' }));
    expect(screen.getByRole('textbox', { name: /홈페이지 주소/ })).toHaveValue('sindae');
    expect(screen.getByText('지금 신청한 주소예요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신청 내용 저장' })).toBeDisabled();
    expect(checkSiteSlug).not.toHaveBeenCalled();
  });

  it('ACTIVE: address with copy / open, colour and 한 줄 소개 saved with PATCH', async () => {
    const user = userEvent.setup();
    const data = mine({
      status: 'ACTIVE',
      slug: 'sindae',
      requestedSlug: 'sindae',
      color: 'GREEN',
    });
    updateSite.mockResolvedValue({
      ...data,
      site: { ...data.site!, color: 'RED', updatedAt: new Date().toISOString() },
    });
    mount(data);
    expect(await screen.findByText('운영 중')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈페이지 열기 (새 창)' })).toHaveAttribute(
      'href',
      data.site!.url!,
    );
    expect(screen.getByRole('button', { name: '주소 복사' })).toBeInTheDocument();
    expect(screen.queryByText(/주소 준비 중/)).toBeNull();

    const save = screen.getByRole('button', { name: '저장' });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: AGENCY_SITE_COLORS.RED.label }));
    expect(screen.getByText('저장하지 않은 변경사항이 있어요')).toBeInTheDocument();
    await user.click(save);
    await waitFor(() =>
      expect(updateSite).toHaveBeenCalledWith({ color: 'RED', tagline: data.site!.tagline }),
    );
  });

  it('ACTIVE before the certificate: 주소 준비 중, no open / copy until HTTPS is ready', async () => {
    const preparing = mine({ status: 'ACTIVE', slug: 'sindae', httpsReady: false });
    mount(preparing);
    expect(await screen.findByText('주소 준비 중 — 보통 10분 안에 열려요')).toBeInTheDocument();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
    expect(screen.queryByText('운영 중')).toBeNull();
    // The host is shown as text only: opening it now would hit a certificate error.
    expect(screen.getAllByText(new URL(preparing.site!.url!).host).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: '홈페이지 열기 (새 창)' })).toBeNull();
    expect(screen.queryByRole('button', { name: '주소 복사' })).toBeNull();
    expect(screen.queryByRole('link', { name: new URL(preparing.site!.url!).host })).toBeNull();
  });

  it('주소 준비 중 polls the site until HTTPS is ready, then offers open / copy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const preparing = mine({ status: 'ACTIVE', slug: 'sindae', httpsReady: false });
      const ready = { ...preparing, site: { ...preparing.site!, httpsReady: true, live: true } };
      mount(preparing);
      expect(await screen.findByText('주소 준비 중 — 보통 10분 안에 열려요')).toBeInTheDocument();
      fetchMySite.mockResolvedValue(ready);
      await vi.advanceTimersByTimeAsync(61_000);
      expect(
        await screen.findByRole('link', { name: '홈페이지 열기 (새 창)' }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/주소 준비 중/)).toBeNull();
      const calls = fetchMySite.mock.calls.length;
      await vi.advanceTimersByTimeAsync(61_000);
      expect(fetchMySite.mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the slug field is described by its help or error, the suffix and the live check', async () => {
    const user = userEvent.setup();
    mount(mine(null));
    const input = await screen.findByRole('textbox', { name: /홈페이지 주소/ });
    expect(input).toHaveAccessibleDescription(
      /승인 뒤에는 바꿀 수 없어요.*전체 주소: 입력한 이름\.localhost/,
    );
    await user.type(input, 'ab');
    await user.click(screen.getByRole('button', { name: '신청하기' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/3~30자/);
    expect(input).toHaveAccessibleDescription(/전체 주소: 입력한 이름\.localhost/);
  });

  it('REJECTED: the reason and a re-request form', async () => {
    mount(
      mine({
        status: 'REJECTED',
        requestedSlug: 'sindae-best1',
        decisionReason: REJECT_REASON_SAMPLE,
      }),
    );
    expect(await screen.findByText('신청이 반려되었어요')).toBeInTheDocument();
    expect(screen.getByText(REJECT_REASON_SAMPLE, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '다시 신청하기' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /홈페이지 주소/ })).toHaveValue('sindae-best1');
  });

  it('SUSPENDED: the notice and reason', async () => {
    mount(mine({ status: 'SUSPENDED', slug: 'sindae', decisionReason: SUSPEND_REASON_SAMPLE }));
    expect(await screen.findByText('홈페이지 운영이 정지되었어요')).toBeInTheDocument();
    expect(screen.getByText(SUSPEND_REASON_SAMPLE, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '고객센터 문의' })).toHaveAttribute('href', '/support');
  });

  it('staff: read-only (no form, disabled colours)', async () => {
    mount(mine({ status: 'ACTIVE', slug: 'sindae' }), { ...owner(), myRole: 'AGENT' });
    expect(await screen.findByText(/대표 공인중개사만 할 수 있어요/)).toBeInTheDocument();
    const swatches = screen.getByRole('group', { name: '브랜드 색' });
    for (const radio of within(swatches).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  });

  it('an office that is not approved cannot request a site', async () => {
    mount(mine(null), { ...owner(), status: 'PENDING' });
    expect(
      await screen.findByText('승인된 사무소만 홈페이지를 신청할 수 있어요'),
    ).toBeInTheDocument();
  });
});
