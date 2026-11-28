import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import * as inquiryApi from './api';
import { InquiryDialog, type InquiryDialogProps } from './components/InquiryDialog';
import { MyInquiryThreadView } from './me/MyInquiryThreadView';
import {
  EMPTY_INQUIRY_FORM,
  appendStarter,
  messageCounter,
  smsMessage,
  toInquiryBody,
  validateInquiryForm,
} from './lib';
import {
  inquiryListingRefSchema,
  myInquiryDetailSchema,
  myInquiryListItemSchema,
  type MyInquiry,
} from './schemas';
import { myInquiries, myInquiryDetail, myInquiryItem } from '@/app/mock-api/v1/inquiries/_store';

const toast = vi.fn();
vi.mock('@house/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@house/ui')>()),
  useToast: () => ({ toast, dismiss: vi.fn() }),
}));

const session = vi.hoisted(() => ({
  value: { user: null as null | Record<string, unknown>, status: 'unauthenticated' },
}));
vi.mock('@/lib/auth', () => ({ useSession: () => session.value }));

const TERMS = [
  {
    type: 'INQUIRY_PRIVACY',
    version: '1.0',
    title: '[필수] 문의 개인정보 수집·이용 및 제공 동의',
    content: '- 수집 항목: 이름, 연락처, 문의 내용',
    effectiveAt: null,
  },
];
const terms = vi.hoisted(() => ({ refetch: vi.fn() }));
vi.mock('@/lib/api/useActionTerms', () => ({
  useActionTerms: () => ({ data: TERMS, isError: false, error: null, refetch: terms.refetch }),
}));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  sendInquiry: vi.fn(),
  logContactEvent: vi.fn(),
  fetchMyInquiry: vi.fn(),
  sendFollowUp: vi.fn(),
}));
const sendInquiry = vi.mocked(inquiryApi.sendInquiry);
const logContactEvent = vi.mocked(inquiryApi.logContactEvent);
const fetchMyInquiry = vi.mocked(inquiryApi.fetchMyInquiry);
const sendFollowUp = vi.mocked(inquiryApi.sendFollowUp);

const AGENCY_ID = '0a1b2c3d-0000-4000-8000-0a1b2c3d0a1b';
const LISTING_ID = '1f2e3d4c-0000-4000-8000-1f2e3d4c1f2e';

function mount(props: Partial<InquiryDialogProps> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InquiryDialog
        open
        onClose={onClose}
        agency={{
          id: AGENCY_ID,
          name: '신대중앙 공인중개사사무소',
          phone: '0617220101',
          representativeName: '김서진',
        }}
        listing={{ id: LISTING_ID, no: '100412', label: '신대 레이크파크 103동 매매 4억 4,500' }}
        details={[{ label: '등록번호', value: '46150-2019-00012', num: true }]}
        moreHref="/agency/b01"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: '중개사무소에 문의하기' }) };
}

const fill = async (
  dialog: HTMLElement,
  values: { name?: string; phone?: string; message?: string },
) => {
  if (values.name !== undefined) {
    const name = within(dialog).getByRole('textbox', { name: /이름/ });
    await userEvent.clear(name);
    await userEvent.type(name, values.name);
  }
  if (values.phone !== undefined) {
    await userEvent.type(within(dialog).getByRole('textbox', { name: /연락처/ }), values.phone);
  }
  if (values.message !== undefined) {
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /문의 내용/ }),
      values.message,
    );
  }
};

beforeEach(() => {
  toast.mockClear();
  sendInquiry.mockReset();
  logContactEvent.mockReset();
  terms.refetch.mockClear();
  session.value = { user: null, status: 'unauthenticated' };
});

describe('inquiry form rules', () => {
  const ok = { ...EMPTY_INQUIRY_FORM, name: '김하늘', message: '집 볼 수 있을까요?', agree: true };

  it('needs a phone from guests only, and the consent from everyone', () => {
    expect(validateInquiryForm(ok, { member: true })).toEqual({});
    expect(validateInquiryForm(ok, { member: false })).toEqual({
      phone: '답변을 받을 연락처를 입력해 주세요.',
    });
    expect(validateInquiryForm({ ...ok, phone: '010-1234-5678' }, { member: false })).toEqual({});
    const errors = validateInquiryForm(
      { ...EMPTY_INQUIRY_FORM, phone: '12', message: '짧음' },
      { member: false },
    );
    expect(Object.keys(errors).sort()).toEqual(['agree', 'message', 'name', 'phone']);
    expect(errors.message).toBe('문의 내용을 5자 이상 입력해 주세요.');
  });

  it('builds the POST /inquiries body', () => {
    const consents = [{ type: 'INQUIRY_PRIVACY' as const, version: '1.0' }];
    expect(
      toInquiryBody(
        { ...ok, name: ' 김하늘 ', phone: '010-1234-5678', message: ' 문의합니다 ' },
        { agencyId: AGENCY_ID, listingId: LISTING_ID, source: 'MAIN' },
        consents,
      ),
    ).toEqual({
      agencyId: AGENCY_ID,
      listingId: LISTING_ID,
      name: '김하늘',
      phone: '01012345678',
      message: '문의합니다',
      source: 'MAIN',
      consents,
    });
    // A bot's honeypot value is sent as is (the server refuses it); members may skip the phone.
    expect(
      toInquiryBody(
        { ...ok, website: 'http://spam' },
        { agencyId: AGENCY_ID, source: 'SITE' },
        consents,
      ),
    ).toMatchObject({ listingId: null, phone: null, website: 'http://spam', source: 'SITE' });
  });

  it('helps with the message text', () => {
    expect(appendStarter('', '가격 조정이 가능한지 궁금해요.')).toBe(
      '가격 조정이 가능한지 궁금해요.',
    );
    expect(appendStarter('안녕하세요.  ', '가격 조정이 가능한지 궁금해요.')).toBe(
      '안녕하세요.\n가격 조정이 가능한지 궁금해요.',
    );
    expect(appendStarter('가격 조정이 가능한지 궁금해요.', '가격 조정이 가능한지 궁금해요.')).toBe(
      '가격 조정이 가능한지 궁금해요.',
    );
    expect(messageCounter('  다섯 글자  ')).toBe('5/1,000');
    expect(smsMessage({ no: '100412', label: '신대 103동' })).toContain(
      '매물번호 100412 (신대 103동)',
    );
  });
});

describe('<InquiryDialog> 문의 남기기', () => {
  it('guest: asks for the missing fields, then sends name, number, text and consent', async () => {
    sendInquiry.mockResolvedValue({ id: 'q1', createdAt: '2026-11-28T00:00:00Z', member: false });
    const { dialog } = mount();
    expect(within(dialog).getByRole('tab', { name: '문의 남기기' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(dialog).getByText(/로그인하지 않아도 문의할 수 있어요/)).toBeInTheDocument();
    expect(within(dialog).getByText('문의할 매물').parentElement).toHaveTextContent('100412');

    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));
    expect(sendInquiry).not.toHaveBeenCalled();
    expect(within(dialog).getByText('이름을 입력해 주세요.')).toBeInTheDocument();
    expect(within(dialog).getByText('답변을 받을 연락처를 입력해 주세요.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('개인정보 수집·이용 및 제공에 동의해 주세요.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /이름/ })).toHaveFocus();

    await fill(dialog, { name: '김하늘', phone: '010-1234-5678' });
    await userEvent.click(
      within(dialog).getByRole('button', { name: '가격 조정이 가능한지 궁금해요.' }),
    );
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /문의 개인정보/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));

    await waitFor(() => expect(sendInquiry).toHaveBeenCalledTimes(1));
    expect(sendInquiry.mock.calls[0]?.[0]).toEqual({
      agencyId: AGENCY_ID,
      listingId: LISTING_ID,
      name: '김하늘',
      phone: '01012345678',
      message: '가격 조정이 가능한지 궁금해요.',
      source: 'MAIN',
      consents: [{ type: 'INQUIRY_PRIVACY', version: '1.0' }],
    });
    const done = await within(dialog).findByRole('status');
    expect(done).toHaveTextContent('문의를 보냈어요');
    expect(done).toHaveTextContent('중개사무소가 남겨 주신 번호로 연락드릴 거예요.');
    expect(within(done).queryByRole('link', { name: '문의 내역 보기' })).not.toBeInTheDocument();
    // The focused submit button is gone: focus moves to the result, not to <body>.
    expect(within(done).getByRole('heading', { name: '문의를 보냈어요' })).toHaveFocus();
  });

  it('keeps Tab inside the dialog past the last visible control (hidden panel, honeypot)', async () => {
    const user = userEvent.setup();
    const { dialog } = mount();
    await user.click(within(dialog).getByRole('checkbox', { name: /문의 개인정보/ }));
    within(dialog).getByRole('button', { name: '문의 보내기' }).focus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(dialog.querySelector('input[name="website"]'));
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: '문의 보내기' })).toHaveFocus();
  });

  it('reads the character counter with the field instead of announcing every key', async () => {
    const { dialog } = mount();
    await fill(dialog, { message: '안녕하세요' });
    const field = within(dialog).getByRole('textbox', { name: /문의 내용/ });
    expect(field).toHaveAccessibleDescription(/5\/1,000/);
    const counter = within(dialog).getByText(messageCounter('안녕하세요'));
    expect(counter).not.toHaveAttribute('aria-live');
  });

  it('member: name prefilled, phone optional, the answer is under MY > 문의 내역', async () => {
    session.value = {
      user: { id: 'u1', name: '김하늘', nickname: '순천살이', hasNickname: true, phone: null },
      status: 'authenticated',
    };
    sendInquiry.mockResolvedValue({ id: 'q 9', createdAt: '2026-11-28T00:00:00Z', member: true });
    const { dialog } = mount();
    expect(within(dialog).getByRole('textbox', { name: /이름/ })).toHaveValue('김하늘');
    expect(within(dialog).getByRole('textbox', { name: /연락처 \(선택\)/ })).not.toBeRequired();
    expect(within(dialog).queryByText(/로그인하지 않아도/)).not.toBeInTheDocument();

    await fill(dialog, { message: '주말에 방문 가능할까요?' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /문의 개인정보/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));
    const done = await within(dialog).findByRole('status');
    expect(done).toHaveTextContent('MY > 문의 내역에서 답변을 볼 수 있어요.');
    expect(within(done).getByRole('link', { name: '문의 내역 보기' })).toHaveAttribute(
      'href',
      '/me/inquiries/q%209',
    );
    expect(sendInquiry.mock.calls[0]?.[0]).toMatchObject({ phone: null, name: '김하늘' });
  });

  it('maps server refusals onto the form', async () => {
    sendInquiry.mockRejectedValueOnce(
      new ApiError(400, {
        code: 'INQUIRY_PHONE_REQUIRED',
        message: '답변을 받을 연락처를 입력해 주세요.',
      }),
    );
    session.value = {
      user: { id: 'u1', hasNickname: false, nickname: '회원' },
      status: 'authenticated',
    };
    const { dialog } = mount({ listing: null });
    await fill(dialog, { name: '김하늘', message: '사무소에 문의드립니다.' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /문의 개인정보/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));
    expect(
      await within(dialog).findByText('답변을 받을 연락처를 입력해 주세요.'),
    ).toBeInTheDocument();

    sendInquiry.mockRejectedValueOnce(
      new ApiError(429, {
        code: 'INQUIRY_DAILY_LIMIT',
        message: '오늘 보낼 수 있는 문의 수를 모두 사용했습니다. 내일 다시 시도해 주세요.',
      }),
    );
    await userEvent.type(within(dialog).getByRole('textbox', { name: /연락처/ }), '01012345678');
    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));
    expect(await within(dialog).findByText(/오늘 보낼 수 있는 문의 수를/)).toBeInTheDocument();

    sendInquiry.mockRejectedValueOnce(
      new ApiError(400, { code: 'AUTH_CONSENT_OUTDATED', message: 'x' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));
    expect(await within(dialog).findByText(/동의 내용이 바뀌었어요/)).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /문의 개인정보/ })).not.toBeChecked();
    expect(terms.refetch).toHaveBeenCalled();
  });

  it('sends a filled honeypot along (the server refuses it)', async () => {
    sendInquiry.mockResolvedValue({ id: 'q1', createdAt: 'x', member: false });
    const { dialog } = mount();
    await fill(dialog, { name: '봇', phone: '01012345678', message: '스팸 메시지입니다' });
    fireEvent.change(dialog.querySelector('input[name="website"]') as HTMLInputElement, {
      target: { value: 'http://spam.example' },
    });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /문의 개인정보/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: '문의 보내기' }));
    await waitFor(() =>
      expect(sendInquiry.mock.calls[0]?.[0]).toMatchObject({ website: 'http://spam.example' }),
    );
  });
});

describe('<InquiryDialog> 바로 연락', () => {
  it('calls, texts and copies the number — each press is logged as a contact event', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { dialog } = mount({ initialTab: 'contact', source: 'SITE' });
    expect(within(dialog).getByRole('tab', { name: '바로 연락' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const call = within(dialog).getByRole('link', { name: '전화 걸기' });
    expect(call).toHaveAttribute('href', 'tel:0617220101');
    const sms = within(dialog).getByRole('link', { name: '문자 보내기' });
    expect(decodeURIComponent(sms.getAttribute('href') ?? '')).toContain('매물번호 100412');
    expect(within(dialog).getByText('46150-2019-00012')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', { name: /사무소 정보와 다른 매물 보기/ }),
    ).toHaveAttribute('href', '/agency/b01');

    call.addEventListener('click', (e) => e.preventDefault());
    sms.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(call);
    await userEvent.click(sms);
    await userEvent.click(
      within(dialog).getByRole('button', { name: /전화번호 061-722-0101 복사/ }),
    );
    expect(writeText).toHaveBeenCalledWith('061-722-0101');
    expect(logContactEvent.mock.calls.map((c) => c[0])).toEqual([
      { agencyId: AGENCY_ID, listingId: LISTING_ID, channel: 'CALL', source: 'SITE' },
      { agencyId: AGENCY_ID, listingId: LISTING_ID, channel: 'SMS', source: 'SITE' },
      { agencyId: AGENCY_ID, listingId: LISTING_ID, channel: 'COPY', source: 'SITE' },
    ]);
  });

  it('keeps what was typed when switching tabs, and disables 바로 연락 without a number', async () => {
    const { dialog } = mount();
    await fill(dialog, { message: '안녕하세요' });
    await userEvent.click(within(dialog).getByRole('tab', { name: '바로 연락' }));
    await userEvent.click(within(dialog).getByRole('tab', { name: '문의 남기기' }));
    expect(within(dialog).getByRole('textbox', { name: /문의 내용/ })).toHaveValue('안녕하세요');
  });

  it('opens on 문의 남기기 when the office has no phone', () => {
    const { dialog } = mount({
      initialTab: 'contact',
      agency: { id: AGENCY_ID, name: '번호 없는 사무소', phone: null },
    });
    expect(within(dialog).getByRole('tab', { name: '바로 연락' })).toBeDisabled();
    expect(within(dialog).getByRole('tab', { name: '문의 남기기' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('<MyInquiryThreadView> 추가 문의', () => {
  const thread = (patch: Partial<MyInquiry> = {}): MyInquiry => ({
    ...myInquiryDetailSchema.parse(myInquiryDetail(myInquiries('USER')[0]!)),
    ...patch,
  });
  const show = (initial: MyInquiry) => {
    fetchMyInquiry.mockResolvedValue(initial);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MyInquiryThreadView initial={initial} />
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    fetchMyInquiry.mockReset();
    sendFollowUp.mockReset();
  });

  it('a refused follow-up (409) closes the box with a message for the member', async () => {
    sendFollowUp.mockRejectedValue(
      new ApiError(409, {
        code: 'INQUIRY_REPLY_NOT_ALLOWED',
        message: '이 문의에는 답변을 남길 수 없습니다. 남겨 주신 연락처로 직접 연락해 주세요.',
      }),
    );
    show(thread());
    await userEvent.type(screen.getByRole('textbox', { name: '추가 문의' }), '주말 방문 될까요?');
    await userEvent.click(screen.getByRole('button', { name: '보내기' }));
    expect(await screen.findByText(/더 이상 메시지를 남길 수 없어요/)).toBeInTheDocument();
    // Not the office-side copy, no retry box; what was typed stays readable.
    expect(screen.queryByText(/남겨 주신 연락처로/)).toBeNull();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '보내기' })).toBeNull();
    expect(screen.getByRole('textbox', { name: '보내지 못한 내용' })).toHaveValue(
      '주말 방문 될까요?',
    );
  });

  it('no box for a thread retention erased, or when the API says no', () => {
    show(thread({ message: '', name: null, phone: null }));
    expect(screen.queryByRole('textbox', { name: '추가 문의' })).toBeNull();
    expect(screen.getByText(/더 이상 메시지를 남길 수 없어요/)).toBeInTheDocument();
  });

  it('honours the API flag when it is sent', () => {
    show(thread({ canFollowUp: false }));
    expect(screen.queryByRole('textbox', { name: '추가 문의' })).toBeNull();
  });

  it('keeps the box for an open thread', () => {
    show(thread());
    expect(screen.getByRole('textbox', { name: '추가 문의' })).toBeInTheDocument();
  });
});

describe('MY 문의 내역 schemas ↔ mock fixtures', () => {
  it('parses the mock member’s inquiries and threads', () => {
    const mine = myInquiries('USER');
    expect(mine.length).toBeGreaterThan(0);
    for (const i of mine) {
      expect(myInquiryListItemSchema.safeParse(myInquiryItem(i)).success, i.id).toBe(true);
      expect(myInquiryDetailSchema.safeParse(myInquiryDetail(i)).success, i.id).toBe(true);
    }
    // One answered thread the member has not opened yet.
    expect(mine.some((i) => myInquiryItem(i).hasUnreadReply)).toBe(true);
    expect(
      inquiryListingRefSchema.parse({ id: 'x', title: 't', assetType: 'APT', dealType: 'SALE' }),
    ).toMatchObject({ salePrice: null, coverPhotoUrl: null });
  });
});
