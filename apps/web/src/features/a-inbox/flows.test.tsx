import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICE_LISTINGS } from '@/app/mock-api/v1/agency/deal-requests/_listings';
import { seedInboxRequests } from '@/app/mock-api/v1/agency/deal-requests/_seed';
import { agencyRequestDetailDto } from '@/app/mock-api/v1/agency/deal-requests/_store';
import { ApiError } from '@/lib/api';
import * as queries from './api/queries';
import {
  agencyDealRequestDetailSchema,
  type AgencyDealRequestDetail,
  type MyProposal,
} from './api/schemas';
import { parseRequestFilters, requestFiltersToSearch } from './lib/params';
import { ListingPicker } from './requests/ListingPicker';
import { ProposalForm } from './requests/ProposalForm';
import { RequestSummary } from './requests/RequestSummary';
import { useUrlState } from './ui/useUrlState';

const toast = vi.fn();
vi.mock('@house/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@house/ui')>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

const nav = vi.hoisted(() => ({ pathname: '/agent/requests', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock('./api/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/queries')>()),
  fetchListingCandidates: vi.fn(),
  sendProposal: vi.fn(),
}));
const fetchCandidates = vi.mocked(queries.fetchListingCandidates);
const sendProposal = vi.mocked(queries.sendProposal);

const seeds = seedInboxRequests();
const detail = (id: string): AgencyDealRequestDetail => {
  const found = seeds.find((r) => r.id === id);
  if (!found) throw new Error(`missing seed ${id}`);
  return agencyDealRequestDetailSchema.parse(agencyRequestDetailDto(found));
};

function candidatePage(q = '') {
  const items = OFFICE_LISTINGS.filter((l) => l.title.includes(q));
  return { items, page: 1, pageSize: 50, total: items.length, totalPages: 1 };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const sentProposal = (message: string): MyProposal => ({
  id: 'p-1',
  status: 'SENT',
  message,
  listings: [],
  memberName: '오세린',
  createdAt: new Date().toISOString(),
  viewedAt: null,
  respondedAt: null,
});

beforeEach(() => {
  toast.mockClear();
  fetchCandidates.mockReset();
  fetchCandidates.mockImplementation((_id, q) => Promise.resolve(candidatePage(q)));
  sendProposal.mockReset();
  nav.pathname = '/agent/requests';
  nav.search = '';
});

describe('useUrlState', () => {
  const hook = () => renderHook(() => useUrlState(parseRequestFilters, requestFiltersToSearch));

  it('reads the filters from the query string', () => {
    nav.search = 'stage=new&type=find&page=2';
    const { result } = hook();
    expect(result.current[0]).toMatchObject({ stage: 'new', type: 'find', page: 2 });
  });

  it('writes shallow history entries: push by default, replace on request', () => {
    const push = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const replace = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const { result } = hook();
    const [state, setState] = result.current;

    act(() => setState({ ...state, stage: 'proposed' }));
    expect(push).toHaveBeenCalledWith(null, '', '/agent/requests?stage=proposed');

    act(() => setState({ ...state, type: 'sell' }, { replace: true }));
    expect(replace).toHaveBeenCalledWith(null, '', '/agent/requests?type=sell');
    expect(push).toHaveBeenCalledTimes(1);
    push.mockRestore();
    replace.mockRestore();
  });

  it('does not add a history entry when nothing changes', () => {
    window.history.replaceState(null, '', '/agent/requests');
    const push = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const { result } = hook();
    act(() => result.current[1](result.current[0]));
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });
});

describe('<RequestSummary> privacy hint', () => {
  it('promises the address only while the request is still active', () => {
    const closed = detail('req-09');
    expect(closed.status).toBe('CLOSED');
    render(<RequestSummary request={closed} />);
    expect(screen.queryByText(/동·호수는 요청자가 연락처를 공개하면/)).not.toBeInTheDocument();
  });
});

describe('<ListingPicker>', () => {
  const request = detail('req-02');
  const [first, second] = OFFICE_LISTINGS;
  if (!first || !second) throw new Error('fixtures');

  it('ranks the office listings, applies the picked ones and keeps them across a search', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <ListingPicker open onClose={onClose} request={request} selected={[]} onApply={onApply} />,
      {
        wrapper,
      },
    );
    const dialog = await screen.findByRole('dialog', { name: '첨부할 매물 고르기' });
    const boxes = await within(dialog).findAllByRole('checkbox');
    expect(boxes).toHaveLength(OFFICE_LISTINGS.length);
    // Full matches for a 신대지구 아파트 매매 ≤ 4억 5,000 request come first.
    expect(within(dialog).getAllByText('조건 일치').length).toBeGreaterThan(0);

    await user.click(boxes[0]!);
    await user.type(within(dialog).getByLabelText('매물 이름 검색'), '오피스텔');
    await waitFor(() =>
      expect(fetchCandidates).toHaveBeenCalledWith(request.id, '오피스텔', expect.anything()),
    );
    await waitFor(() =>
      expect(within(dialog).getAllByRole('checkbox').length).toBeLessThan(OFFICE_LISTINGS.length),
    );
    await user.click(within(dialog).getAllByRole('checkbox')[0]!);

    expect(within(dialog).getByText(/선택/)).toHaveTextContent('선택 2 / 10');
    await user.click(within(dialog).getByRole('button', { name: '2건 첨부' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).toHaveLength(2);
    expect(onClose).toHaveBeenCalled();
  });

  it('starts every session from the applied selection, not from an abandoned draft', async () => {
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), request, selected: [first], onApply: vi.fn() };
    const { rerender } = render(<ListingPicker open {...props} />, { wrapper });
    let dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getAllByRole('checkbox', { checked: true })).toHaveLength(1),
    );
    // Tick another one, then close without applying.
    const unchecked = within(dialog).getAllByRole('checkbox', { checked: false });
    await user.click(unchecked[0]!);
    expect(within(dialog).getAllByRole('checkbox', { checked: true })).toHaveLength(2);
    rerender(<ListingPicker open={false} {...props} />);
    rerender(<ListingPicker open {...props} />);
    dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(dialog).getAllByRole('checkbox', { checked: true })).toHaveLength(1),
    );
    expect(within(dialog).getByLabelText('매물 이름 검색')).toHaveValue('');
  });

  it('says when the office has more listings than the one page it shows', async () => {
    fetchCandidates.mockResolvedValueOnce({ ...candidatePage(), total: 80, totalPages: 2 });
    render(
      <ListingPicker open onClose={vi.fn()} request={request} selected={[]} onApply={vi.fn()} />,
      {
        wrapper,
      },
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText(/광고중 매물 80건 중 \d+건만 보여 드려요/),
    ).toBeInTheDocument();
  });
});

describe('<ProposalForm>', () => {
  it('validates inline and sends nothing while the form is invalid', async () => {
    const user = userEvent.setup();
    render(<ProposalForm request={detail('req-01')} onSent={vi.fn()} onStale={vi.fn()} />, {
      wrapper,
    });
    await user.type(screen.getByLabelText(/제안 내용/), '짧음');
    await user.type(screen.getByLabelText('예상 매매가 (만원)'), '얼마');
    await user.click(screen.getByRole('button', { name: '제안 보내기' }));
    expect(await screen.findByText('제안 내용을 10자 이상 적어 주세요.')).toBeInTheDocument();
    expect(screen.getByText(/금액을 확인해 주세요/)).toBeInTheDocument();
    expect(sendProposal).not.toHaveBeenCalled();
  });

  it('sends the message with the suggested price as its leading line (내놓기)', async () => {
    const user = userEvent.setup();
    const onSent = vi.fn();
    sendProposal.mockImplementation((_id, body) => Promise.resolve(sentProposal(body.message)));
    render(
      <ProposalForm
        request={detail('req-01')}
        agencyName="신대중앙 공인중개사사무소"
        memberName="오세린"
        onSent={onSent}
        onStale={vi.fn()}
      />,
      { wrapper },
    );
    await user.click(screen.getByRole('button', { name: '인사' }));
    await user.click(screen.getByRole('button', { name: '거래 경험' }));
    await user.click(screen.getByRole('button', { name: '희망가 그대로' }));
    expect(screen.getByLabelText('예상 매매가 (만원)')).toHaveValue('45000');
    expect(screen.getByText('4억 5,000만원')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '제안 보내기' }));
    await waitFor(() => expect(sendProposal).toHaveBeenCalledTimes(1));
    const [id, body] = sendProposal.mock.calls[0]!;
    expect(id).toBe('req-01');
    expect(body.listingIds).toEqual([]);
    expect(
      body.message.startsWith(
        '· 예상 매매가 4억 5,000\n\n안녕하세요, 신대중앙 공인중개사사무소 오세린입니다.',
      ),
    ).toBe(true);
    await waitFor(() =>
      expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' })),
    );
  });

  it('has no price inputs for 구하기 and attaches the picked listings', async () => {
    const user = userEvent.setup();
    sendProposal.mockImplementation((_id, body) => Promise.resolve(sentProposal(body.message)));
    render(<ProposalForm request={detail('req-02')} onSent={vi.fn()} onStale={vi.fn()} />, {
      wrapper,
    });
    expect(screen.queryByLabelText(/예상 .*\(만원\)/)).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/제안 내용/),
      '조건에 맞는 실매물 두 건을 골라 보냅니다.',
    );
    await user.click(screen.getByRole('button', { name: '내 매물에서 고르기' }));
    const dialog = await screen.findByRole('dialog');
    const boxes = await within(dialog).findAllByRole('checkbox');
    await user.click(boxes[0]!);
    await user.click(within(dialog).getByRole('button', { name: '1건 첨부' }));
    expect(
      screen.getByRole('button', { name: /매물 다시 고르기 \(1건 선택\)/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '제안 보내기' }));
    await waitFor(() => expect(sendProposal).toHaveBeenCalledTimes(1));
    const body = sendProposal.mock.calls[0]![1];
    expect(body.listingIds).toHaveLength(1);
    expect(OFFICE_LISTINGS.map((l) => l.id)).toContain(body.listingIds[0]);
    expect(body.message).toBe('조건에 맞는 실매물 두 건을 골라 보냅니다.');
  });

  it('maps server validation to the field and reloads a request that stopped taking proposals', async () => {
    const user = userEvent.setup();
    const onStale = vi.fn();
    render(<ProposalForm request={detail('req-02')} onSent={vi.fn()} onStale={onStale} />, {
      wrapper,
    });
    const text = '조건에 맞는 실매물을 골라 안내해 드리겠습니다.';
    await user.type(screen.getByLabelText(/제안 내용/), text);

    sendProposal.mockRejectedValueOnce(
      new ApiError(400, {
        code: 'VALIDATION_FAILED',
        message: '입력값을 확인해 주세요.',
        details: [{ path: 'message', message: '연락처는 제안 내용에 적을 수 없습니다.' }],
      }),
    );
    await user.click(screen.getByRole('button', { name: '제안 보내기' }));
    expect(await screen.findByText('연락처는 제안 내용에 적을 수 없습니다.')).toBeInTheDocument();
    expect(onStale).not.toHaveBeenCalled();

    sendProposal.mockRejectedValueOnce(
      new ApiError(409, { code: 'PROPOSAL_DUPLICATE', message: '이미 제안을 보냈습니다.' }),
    );
    await user.click(screen.getByRole('button', { name: '제안 보내기' }));
    await waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });
});
