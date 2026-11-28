import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { seedDashboard } from '@/app/mock-api/v1/agencies/mine/_fixtures';
import { agencyInquiryView, officeInquiries } from '@/app/mock-api/v1/inquiries/_store';
import type { SessionUser } from '@/lib/auth';
import * as queries from '../api/queries';
import { agencyDashboardSchema } from '../api/schemas';
import { DashboardView } from './DashboardView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api/useMyAgency', () => ({
  useMyAgency: () => ({ data: null, isPending: false, error: null, refetch: vi.fn() }),
}));
vi.mock('../api/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/queries')>()),
  fetchDashboard: vi.fn(),
}));
const fetchDashboard = vi.mocked(queries.fetchDashboard);

function mount(unreadCount: number) {
  const items = officeInquiries()
    .filter((i) => i.channel === 'MESSAGE')
    .slice(0, 3)
    .map((i) => agencyInquiryView(i));
  fetchDashboard.mockResolvedValue(
    agencyDashboardSchema.parse({ ...seedDashboard(), inquiries: { unreadCount, items } }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DashboardView user={{ name: '김서진', nickname: '서진' } as SessionUser} />
    </QueryClientProvider>,
  );
  return items.length;
}

describe('<DashboardView> 최근 문의', () => {
  it('labels the unread count, so it does not read as the number of listed inquiries', async () => {
    const listed = mount(1);
    expect(listed).toBeGreaterThan(1);
    const heading = await screen.findByRole('heading', { name: /^최근 문의/ });
    expect(heading).toHaveTextContent('최근 문의 안 읽음 1');
  });

  it('shows no count when everything is read', async () => {
    mount(0);
    expect(await screen.findByRole('heading', { name: /^최근 문의/ })).toHaveTextContent(
      /^최근 문의$/,
    );
  });
});
