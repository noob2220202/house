import { ToastProvider } from '@house/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapJobSchema, type BootstrapJob } from '../api/schemas';
import { BOOTSTRAP_LIST_HREF, ComplexBootstrapCard } from './ComplexBootstrapCard';

const api = vi.hoisted(() => ({
  latestBootstrap: vi.fn(),
  bootstrapJob: vi.fn(),
  startBootstrap: vi.fn(),
}));
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, complexes: { ...actual.complexes, ...api } };
});

const item = (over: Record<string, unknown>) => ({
  action: 'CREATE',
  reason: null,
  name: '연향부영3차',
  emdName: '연향동',
  emdCode: '12150114',
  jibunAddress: '순천시 연향동 1234-5',
  roadAddress: '순천시 연향번영길 100',
  builtYear: 1998,
  areaTypeCount: 2,
  exclusiveAreas: [59.84, 84.97],
  hasLocation: true,
  externalCode: '12150-1001',
  saleCount: 3,
  rentCount: 1,
  complexId: null,
  ...over,
});

/** A GET /admin/complexes/bootstrap/:jobId answer as the API sends it (parsed by the real schema). */
function job(over: Record<string, unknown> = {}): BootstrapJob {
  return bootstrapJobSchema.parse({
    jobId: 'bootstrap.1764000000000',
    status: 'completed',
    dryRun: true,
    months: 60,
    fromYm: 202111,
    toYm: 202610,
    progress: { phase: 'done', done: 1, total: 1, percent: 100 },
    preview: {
      fromYm: 202111,
      toYm: 202610,
      rows: 8,
      candidates: 4,
      toCreate: 3,
      toUpdate: 0,
      unchanged: 0,
      needsLocation: 1,
      skipped: 0,
      sample: [
        item({}),
        item({
          name: '신대중흥S-클래스',
          emdName: '해룡면 신대리',
          builtYear: 2015,
          areaTypeCount: 1,
        }),
        item({ name: '왕지현대', emdName: '왕지동', action: 'NEEDS_LOCATION', hasLocation: false }),
      ],
      needsLocationItems: [
        item({ name: '왕지현대', emdName: '왕지동', action: 'NEEDS_LOCATION', hasLocation: false }),
      ],
      skippedItems: [],
    },
    result: null,
    failedReason: null,
    createdAt: '2026-11-25T01:00:00.000Z',
    finishedAt: '2026-11-25T01:03:00.000Z',
    ...over,
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  api.latestBootstrap.mockReset().mockResolvedValue({ item: null });
  api.bootstrapJob.mockReset();
  api.startBootstrap.mockReset();
});

describe('<ComplexBootstrapCard>', () => {
  it('starts a 5-year preview and shows counts and the sample table', async () => {
    const user = userEvent.setup();
    api.startBootstrap.mockResolvedValue({
      jobId: 'bootstrap.1764000000000',
      state: 'waiting',
      dryRun: true,
      months: 60,
    });
    api.bootstrapJob.mockResolvedValue(job());
    render(<ComplexBootstrapCard canRun />, { wrapper });

    expect(screen.getByLabelText('가져올 기간')).toHaveValue('60');
    await user.click(screen.getByRole('button', { name: '미리보기' }));
    expect(api.startBootstrap).toHaveBeenCalledWith({ months: 60, dryRun: true });

    expect(await screen.findByText('새로 만들 단지')).toBeInTheDocument();
    expect(screen.getByText(/실거래 8건에서 단지 4곳을 찾았어요/)).toBeInTheDocument();
    expect(screen.getByText(/2021년 11월 ~ 2026년 10월/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: '단지 만들기 미리보기' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['단지명', '동', '준공', '평형 수', '좌표', '처리']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[1]).toHaveTextContent('신대중흥S-클래스');
    expect(rows[1]).toHaveTextContent('해룡면 신대리');
    expect(rows[1]).toHaveTextContent('2015');
    expect(rows[2]).toHaveTextContent('없음');
    expect(rows[2]).toHaveTextContent('좌표 확인 필요');
    expect(screen.getByRole('button', { name: '단지 만들기 (3곳)' })).toBeEnabled();
  });

  it('creates after confirming and links to the created 단지', async () => {
    const user = userEvent.setup();
    api.latestBootstrap.mockResolvedValue({ item: job() });
    api.bootstrapJob.mockResolvedValueOnce(job());
    render(<ComplexBootstrapCard canRun />, { wrapper });

    await user.click(await screen.findByRole('button', { name: '단지 만들기 (3곳)' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('단지 3곳을 만들까요?');

    api.startBootstrap.mockResolvedValue({
      jobId: 'bootstrap.1764000000999',
      state: 'waiting',
      dryRun: false,
      months: 60,
    });
    api.bootstrapJob.mockResolvedValue(
      job({
        jobId: 'bootstrap.1764000000999',
        dryRun: false,
        result: {
          created: 3,
          updated: 0,
          unchanged: 0,
          needsLocation: 1,
          skipped: 0,
          areaTypesCreated: 5,
          tradeSyncJobs: 60,
        },
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: '단지 만들기' }));
    expect(api.startBootstrap).toHaveBeenCalledWith({ months: 60, dryRun: false });

    expect(await screen.findByText('단지 만들기를 마쳤어요')).toBeInTheDocument();
    expect(screen.getByText(/실거래가 60개월 동기화를 이어서 진행해요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '자동으로 만든 단지 보기' })).toHaveAttribute(
      'href',
      BOOTSTRAP_LIST_HREF,
    );
    expect(BOOTSTRAP_LIST_HREF).toBe('/complexes?source=TRADE_BOOTSTRAP');
    expect(screen.queryByRole('button', { name: /단지 만들기 \(/ })).toBeNull();
    expect(screen.getByText(/좌표를 찾지 못한 단지 1곳/)).toBeInTheDocument();
  });

  it('shows the progress of a running job and blocks a second start', async () => {
    const running = job({
      status: 'active',
      progress: { phase: 'fetch', done: 30, total: 120, percent: 13 },
      preview: null,
      finishedAt: null,
    });
    api.latestBootstrap.mockResolvedValue({ item: running });
    api.bootstrapJob.mockResolvedValue(running);
    render(<ComplexBootstrapCard canRun />, { wrapper });

    const bar = await screen.findByRole('progressbar', { name: '단지 만들기 진행률' });
    expect(bar).toHaveAttribute('aria-valuenow', '13');
    expect(screen.getByText(/실거래가 자료를 불러오고 있어요/)).toBeInTheDocument();
    expect(screen.getByText('30 / 120회 조회')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미리보기' })).toBeDisabled();
  });

  it('lets an operator see the latest result but not run anything', async () => {
    api.latestBootstrap.mockResolvedValue({ item: job() });
    api.bootstrapJob.mockResolvedValue(job());
    render(<ComplexBootstrapCard canRun={false} />, { wrapper });

    expect(await screen.findByText('새로 만들 단지')).toBeInTheDocument();
    expect(screen.getByText(/관리자 권한부터 실행할 수 있어요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '미리보기' })).toBeNull();
    expect(screen.queryByRole('button', { name: /단지 만들기/ })).toBeNull();
    await waitFor(() => expect(api.startBootstrap).not.toHaveBeenCalled());
  });
});
