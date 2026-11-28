import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agencyInquiryView,
  inquiryStore,
  officeInquiries,
  unreadOfficeCount,
} from '@/app/mock-api/v1/inquiries/_store';
import * as queries from '../api/queries';
import { agencyInquiryPageSchema, agencyInquirySchema, type AgencyInquiry } from '../api/schemas';
import { InquiryDrawer } from './InquiryDrawer';
import { InquiryRow } from './InquiriesView';

const toast = vi.fn();
vi.mock('@house/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@house/ui')>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

vi.mock('../api/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/queries')>()),
  fetchInquiry: vi.fn(),
  updateInquiry: vi.fn(() => Promise.resolve(undefined)),
  replyToInquiry: vi.fn(() => Promise.resolve(undefined)),
  deleteInquiry: vi.fn(() => Promise.resolve(undefined)),
}));
const fetchInquiry = vi.mocked(queries.fetchInquiry);
const updateInquiry = vi.mocked(queries.updateInquiry);
const replyToInquiry = vi.mocked(queries.replyToInquiry);
const deleteInquiry = vi.mocked(queries.deleteInquiry);

const seeded = (id: string): AgencyInquiry => {
  const found = inquiryStore().items.find((i) => i.id === id);
  if (!found) throw new Error(`missing seed ${id}`);
  return agencyInquirySchema.parse(agencyInquiryView(found, true));
};

function mountDrawer(inquiry: AgencyInquiry, onClose = vi.fn()) {
  fetchInquiry.mockResolvedValue(inquiry);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InquiryDrawer id={inquiry.id} seed={inquiry} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: '문의 상세' }) };
}

beforeEach(() => {
  toast.mockClear();
  fetchInquiry.mockReset();
  updateInquiry.mockClear();
  replyToInquiry.mockClear();
  deleteInquiry.mockClear();
});

describe('문의함 schemas ↔ mock fixtures', () => {
  it('parses every seeded row and page like the API answers them', () => {
    const rows = officeInquiries();
    for (const i of rows)
      expect(agencyInquirySchema.safeParse(agencyInquiryView(i, true)).success, i.id).toBe(true);
    const page = agencyInquiryPageSchema.parse({
      items: rows.map((i) => agencyInquiryView(i)),
      page: 1,
      pageSize: 12,
      total: rows.length,
      totalPages: 2,
      unreadCount: unreadOfficeCount(),
      statusCounts: { NEW: 1, IN_PROGRESS: 2, DONE: 3 },
    });
    expect(page.items.every((i) => i.messages.length === 0)).toBe(true);
    // Written answers only for texts of members; contact events never carry a phone.
    expect(
      rows.every((i) => agencyInquiryView(i).canReply === (i.channel === 'MESSAGE' && i.member)),
    ).toBe(true);
    expect(rows.filter((i) => i.channel !== 'MESSAGE').every((i) => !i.customerPhone)).toBe(true);
    expect(unreadOfficeCount()).toBeGreaterThan(0);
  });

  it('tolerates rows of a newer API (unknown enum values, missing extras)', () => {
    const parsed = agencyInquirySchema.parse({
      id: 'x',
      channel: 'KAKAO',
      status: 'ARCHIVED',
      source: 'APP',
      lastMessageAt: '2026-11-28T00:00:00Z',
      createdAt: '2026-11-28T00:00:00Z',
    });
    expect(parsed).toMatchObject({
      channel: 'MESSAGE',
      status: 'NEW',
      source: 'MAIN',
      canReply: false,
      messages: [],
    });
  });
});

describe('<InquiryRow>', () => {
  it('names the customer, shows the 홈페이지 badge and the unread mark', async () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <InquiryRow inquiry={seeded('inq-02')} onOpen={onOpen} />
      </ul>,
    );
    const row = screen.getByRole('button', { name: /이정호 님의 문의/ });
    expect(row).toHaveTextContent('홈페이지');
    expect(row).toHaveTextContent('읽지 않음');
    expect(row).toHaveTextContent('비회원');
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('<InquiryDrawer>', () => {
  it('member text: thread, reply box, and opening it marks it read', async () => {
    const { dialog } = mountDrawer(seeded('inq-01'));
    expect(within(dialog).getByText('박서연 님')).toBeInTheDocument();
    expect(within(dialog).getByText('회원')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '전화 걸기' })).toHaveAttribute(
      'href',
      'tel:01045213387',
    );
    await waitFor(() => expect(updateInquiry).toHaveBeenCalledWith('inq-01', { read: true }));

    const reply = within(dialog).getByRole('textbox', { name: '답변' });
    await userEvent.type(reply, '토요일 오전 10시에 뵐게요.');
    await userEvent.click(within(dialog).getByRole('button', { name: '답변 보내기' }));
    await waitFor(() =>
      expect(replyToInquiry).toHaveBeenCalledWith('inq-01', '토요일 오전 10시에 뵐게요.'),
    );
    expect(toast).toHaveBeenCalledWith('답변을 보냈어요. 고객에게 알림이 가요.');
  });

  it('shows the follow-up thread of a member', async () => {
    const { dialog } = mountDrawer(seeded('inq-09'));
    expect(within(dialog).getByText(/임대인께 반려동물 가능 여부를/)).toBeInTheDocument();
    expect(within(dialog).getByText(/보증금은 500만 원 정도/)).toBeInTheDocument();
    expect(within(dialog).getByText(/추가 문의 ·/)).toBeInTheDocument();
  });

  it('guest text: no reply box, a call-back notice with the number', () => {
    const { dialog } = mountDrawer(seeded('inq-02'));
    expect(within(dialog).queryByRole('textbox', { name: '답변' })).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/비회원 문의예요\. 남긴 번호로 전화해 주세요/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('010-9274-8810')).toBeInTheDocument();
    expect(within(dialog).getByText(/사무소 홈페이지 ·/)).toBeInTheDocument();
  });

  it('contact event: what the visitor did, no customer block', () => {
    const { dialog } = mountDrawer(seeded('inq-04'));
    expect(within(dialog).queryByText('고객 정보')).not.toBeInTheDocument();
    expect(within(dialog).getByText('매물 상세에서 전화 걸기를 눌렀어요')).toBeInTheDocument();
    expect(within(dialog).getByText(/고객 연락처는\s*저장되지 않으니/)).toBeInTheDocument();
  });

  it('changes the status and saves the memo', async () => {
    const { dialog } = mountDrawer(seeded('inq-08'));
    await userEvent.click(within(dialog).getByRole('radio', { name: '응대 중' }));
    await waitFor(() =>
      expect(updateInquiry).toHaveBeenCalledWith('inq-08', { status: 'IN_PROGRESS' }),
    );
    const memo = within(dialog).getByRole('textbox', { name: '메모' });
    await userEvent.clear(memo);
    await userEvent.type(memo, '2월 입주 희망');
    await userEvent.click(within(dialog).getByRole('button', { name: '메모 저장' }));
    await waitFor(() =>
      expect(updateInquiry).toHaveBeenCalledWith('inq-08', { memo: '2월 입주 희망' }),
    );
  });

  it('deletes a spam inquiry after the confirmation and closes', async () => {
    const { dialog, onClose } = mountDrawer(seeded('inq-05'));
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    const confirm = screen.getByRole('dialog', { name: '이 문의를 삭제할까요?' });
    expect(within(confirm).getByRole('radio', { name: '스팸·광고' })).toBeChecked();
    await userEvent.click(within(confirm).getByRole('radio', { name: '장난 문의' }));
    await userEvent.click(within(confirm).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(deleteInquiry).toHaveBeenCalledWith('inq-05', '장난 문의'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith('문의를 삭제했어요.');
  });
});
