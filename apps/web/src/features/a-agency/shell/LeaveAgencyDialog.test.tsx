import { ToastProvider } from '@house/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agencyKeys } from '../api/queries';
import { LeaveAgencyDialog } from './LeaveAgencyDialog';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const session = vi.hoisted(() => ({ refresh: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/auth', () => ({ SESSION_QUERY_KEY: ['auth', 'me'], useSession: () => session }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let leaveAnswer: () => Response;
const posted: string[] = [];
const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const path = new URL(input, 'http://localhost').pathname.replace(/^.*\/api\/v1/, '');
  if (path === '/auth/csrf') return json(200, { csrfToken: 't' });
  posted.push(`${init?.method ?? 'GET'} ${path}`);
  return leaveAnswer();
});

function mount(onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(['auth', 'me'], { id: 'u1' });
  client.setQueryData(agencyKeys.mine, { id: 'a1' });
  client.setQueryData(agencyKeys.dashboard, { listings: {} });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LeaveAgencyDialog open onClose={onClose} agencyName="신대 한빛 공인중개사사무소" />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { client, onClose };
}

beforeEach(() => {
  posted.length = 0;
  leaveAnswer = () => new Response(null, { status: 204 });
  router.replace.mockClear();
  router.refresh.mockClear();
  session.refresh.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<LeaveAgencyDialog>', () => {
  it('asks first, then leaves, drops the office caches, refreshes the session and opens /agent/apply', async () => {
    const { client, onClose } = mount();
    const dialog = screen.getByRole('dialog', { name: '사무소에서 나갈까요?' });
    expect(dialog).toHaveTextContent('신대 한빛 공인중개사사무소의 소속 중개사에서 빠져요');
    expect(posted).toEqual([]); // nothing happens before the confirmation

    await userEvent.click(screen.getByRole('button', { name: '사무소 나가기' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/agent/apply'));
    expect(posted).toEqual(['POST /agencies/membership/leave']);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(client.getQueryData(agencyKeys.mine)).toBeUndefined();
    expect(client.getQueryData(agencyKeys.dashboard)).toBeUndefined();
    expect(client.getQueryData(['auth', 'me'])).toEqual({ id: 'u1' });
    expect(await screen.findByText('신대 한빛 공인중개사사무소에서 나왔어요.')).toBeInTheDocument();
  });

  it('shows the server refusal and stays on the page', async () => {
    leaveAnswer = () =>
      json(400, {
        code: 'AGENCY_OWNER_NOT_REMOVABLE',
        message: '대표 공인중개사는 소속에서 제외할 수 없습니다.',
      });
    const { onClose } = mount();
    await userEvent.click(screen.getByRole('button', { name: '사무소 나가기' }));
    expect(
      await screen.findByText('대표 공인중개사는 소속에서 제외할 수 없습니다.'),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    expect(session.refresh).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('취소 closes without calling the API', async () => {
    const { onClose } = mount();
    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalled();
    expect(posted).toEqual([]);
  });
});
