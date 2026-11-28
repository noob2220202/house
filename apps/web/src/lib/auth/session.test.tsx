import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { SessionProvider, fetchSessionUser, useSession } from './session';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const me = (pendingRequiredTerms: string[] = []) => ({
  id: 'u1',
  role: 'USER',
  nickname: '순천살이',
  pendingRequiredTerms,
});
const TERMS = [
  {
    id: 'doc-privacy',
    type: 'PRIVACY',
    version: '1.2',
    title: '개인정보 수집·이용',
    isRequired: true,
    effectiveAt: '2026-12-01T00:00:00+09:00',
  },
  {
    id: 'doc-service',
    type: 'SERVICE',
    version: '1.0',
    title: '이용약관',
    isRequired: true,
    effectiveAt: '2026-10-01T00:00:00+09:00',
  },
];

const fetchMock = vi.fn<typeof fetch>();
const requestUrl = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setCsrfCookie(value: string | null) {
  document.cookie = value
    ? `house_csrf=${value}; path=/`
    : 'house_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfCookie(null);
});

describe('fetchSessionUser', () => {
  it('without house_csrf: one GET /auth/csrf per tab, then "signed out" locally (no /auth/me)', async () => {
    setCsrfCookie(null);
    fetchMock.mockResolvedValue(json({ csrfToken: 'throwaway' }));
    await expect(fetchSessionUser()).resolves.toBeNull();
    await expect(fetchSessionUser()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrl(fetchMock.mock.calls[0]![0])).toContain('/auth/csrf');
  });
  it('self-heals a live session whose house_csrf was lost (browser restart)', async () => {
    setCsrfCookie(null);
    fetchMock.mockImplementation(async (input) => {
      if (requestUrl(input).includes('/auth/csrf')) {
        setCsrfCookie('session-token'); // the API re-issues the cookie for a live session
        return json({ csrfToken: 'session-token' });
      }
      return json(me());
    });
    await expect(fetchSessionUser()).resolves.toMatchObject({ id: 'u1' });
    expect(fetchMock.mock.calls.map((c) => requestUrl(c[0]))).toEqual([
      expect.stringContaining('/auth/csrf'),
      expect.stringContaining('/auth/me'),
    ]);
  });
  it('treats a 401 as signed out, quietly', async () => {
    setCsrfCookie('t');
    fetchMock.mockResolvedValue(
      json({ code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }, 401),
    );
    const error = vi.spyOn(console, 'error');
    await expect(fetchSessionUser()).resolves.toBeNull();
    expect(error).not.toHaveBeenCalled();
  });
  it('parses MeResponse', async () => {
    setCsrfCookie('t');
    fetchMock.mockResolvedValue(json({ ...me(), nickname: null }));
    await expect(fetchSessionUser()).resolves.toMatchObject({ id: 'u1', nickname: '회원' });
  });
});

function renderSession(ui: ReactNode = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>{ui}</SessionProvider>
    </QueryClientProvider>,
  );
  return client;
}

/** Routes the mocked fetch by path. */
function api(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(requestUrl(input), 'http://localhost');
    const path = url.pathname.replace(/^\/(mock-api|api)\/v1/, '');
    const route = routes[`${path}`];
    if (!route) throw new Error(`unexpected ${path}`);
    return route();
  });
}

describe('<SessionProvider> 약관 재동의', () => {
  it('prompts for the pending required document and agrees via POST /me/consents', async () => {
    setCsrfCookie('t');
    const user = userEvent.setup();
    let pending = ['PRIVACY'];
    const posted: unknown[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(requestUrl(input), 'http://localhost').pathname.replace(
        /^\/[a-z-]+\/v1/,
        '',
      );
      if (path === '/auth/me') return json(me(pending));
      if (path === '/terms') return json(TERMS);
      if (path === '/me/consents' && init?.method === 'POST') {
        posted.push(JSON.parse(init.body as string));
        pending = [];
        return json([]);
      }
      throw new Error(`unexpected ${path}`);
    });
    renderSession();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('바뀐 약관을 확인해 주세요');
    const box = await screen.findByRole('checkbox', { name: /개인정보 수집·이용/ });
    // Only the pending document is asked for.
    expect(screen.queryByRole('checkbox', { name: /이용약관/ })).not.toBeInTheDocument();
    const agree = screen.getByRole('button', { name: '동의하고 계속하기' });
    expect(agree).toBeDisabled();
    await user.click(box);
    await user.click(agree);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posted).toEqual([{ consents: [{ termsDocumentId: 'doc-privacy', agreed: true }] }]);
  });

  it('remembers "나중에 할게요" for the tab', async () => {
    setCsrfCookie('t');
    const user = userEvent.setup();
    api({ '/auth/me': () => json(me(['PRIVACY'])), '/terms': () => json(TERMS) });
    renderSession();
    await user.click(await screen.findByRole('button', { name: '나중에 할게요' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem('house:auth:reconsent-dismissed')).toBe('PRIVACY');
  });

  it('opens again when a mutation is refused with 403 AUTH_TERMS_REQUIRED', async () => {
    setCsrfCookie('t');
    const user = userEvent.setup();
    window.sessionStorage.setItem('house:auth:reconsent-dismissed', 'PRIVACY');
    api({ '/auth/me': () => json(me(['PRIVACY'])), '/terms': () => json(TERMS) });

    function Favorite() {
      const { status } = useSession();
      const save = useMutation({
        mutationFn: () =>
          Promise.reject(
            new ApiError(403, {
              code: 'AUTH_TERMS_REQUIRED',
              message: '필수 약관에 동의해 주세요.',
            }),
          ),
      });
      return (
        <button type="button" disabled={status !== 'authenticated'} onClick={() => save.mutate()}>
          관심 등록
        </button>
      );
    }
    renderSession(<Favorite />);
    const button = await screen.findByRole('button', { name: '관심 등록' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByRole('dialog')).toHaveTextContent('바뀐 약관을 확인해 주세요');
  });

  it('waits while another modal (a notice popup) is open', async () => {
    setCsrfCookie('t');
    api({ '/auth/me': () => json(me(['PRIVACY'])), '/terms': () => json(TERMS) });
    const popup = document.createElement('div');
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', '공지');
    document.body.appendChild(popup);
    renderSession();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog', { name: '바뀐 약관을 확인해 주세요' })).toBeNull();
    popup.remove();
    expect(await screen.findByRole('dialog', { name: '바뀐 약관을 확인해 주세요' })).toBeVisible();
  });

  it('stays closed for a member without pending terms', async () => {
    setCsrfCookie('t');
    api({ '/auth/me': () => json(me()) });
    function Status() {
      return <p>{useSession().status}</p>;
    }
    renderSession(<Status />);
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
