import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardQueues, DashboardSummary } from '../../api';
import { KpiRow } from './KpiRow';
import { DealRequestsPanel, ExpiringAdsPanel, ReportsPanel, adHref } from './QueuePanels';

const now = new Date('2026-11-23T05:20:00Z'); // 월 14:20 KST

const kpis: DashboardSummary['kpis'] = {
  visitors: { today: 3482, yesterday: 3206 },
  newListings: { today: 47, yesterday: 35, pendingReview: 12 },
  dealRequests: { today: 5, sell: 3, find: 2, unassigned: 1 },
  pendingAgencies: { count: 4, oldestWaitingDays: 3, needsDocuments: 1 },
};

describe('<KpiRow>', () => {
  it('shows the four KPIs of the draft with their context lines', () => {
    render(<KpiRow kpis={kpis} />);
    const row = screen.getByRole('region', { name: '오늘의 핵심 지표' });
    const cards = within(row).getAllByRole('link');
    expect(cards.map((c) => c.getAttribute('href'))).toEqual([
      '/stats',
      '/listings',
      '/deal-requests',
      '#approvals',
    ]);
    expect(cards[0]).toHaveTextContent('오늘 방문자3,482명');
    expect(cards[0]).toHaveTextContent('8.6%');
    expect(cards[0]).toHaveTextContent('어제 3,206명');
    expect(cards[1]).toHaveTextContent('47건');
    expect(cards[1]).toHaveTextContent('12건어제 대비 · 검수 대기 12');
    expect(cards[2]).toHaveTextContent('내놓기 3구하기 2배정 대기 1');
    expect(cards[3]).toHaveTextContent('가장 오래된 신청 3일째서류 보완 1');
  });

  it('says up / down in words for screen readers, not only with an arrow', () => {
    render(<KpiRow kpis={{ ...kpis, visitors: { today: 3000, yesterday: 3206 } }} />);
    expect(screen.getByText('감소', { exact: false })).toHaveClass('sr-only');
    expect(screen.getByText('증가', { exact: false })).toHaveClass('sr-only');
  });

  it('handles an empty approval queue and a missing baseline', () => {
    render(
      <KpiRow
        kpis={{
          ...kpis,
          visitors: { today: 12, yesterday: 0 },
          pendingAgencies: { count: 0, oldestWaitingDays: null, needsDocuments: 0 },
        }}
      />,
    );
    expect(screen.getByText('대기 중인 신청이 없어요')).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});

describe('dashboard queue panels', () => {
  const dealRequests: DashboardQueues['dealRequests'] = {
    total: 9,
    items: [
      {
        id: 'd-1',
        type: 'SELL_OR_LEASE',
        title: '신대 레이크파크 1단지 · 34평',
        dealType: 'SALE',
        price: 45000,
        deposit: null,
        monthlyRent: null,
        note: '103동 고층',
        createdAt: '2026-11-23T05:08:00Z',
        deliveredAgencyCount: 0,
        activeProposalCount: 0,
      },
      {
        id: 'd-2',
        type: 'WANTED',
        title: '석현동 원룸·투룸 · 월세',
        dealType: 'MONTHLY',
        price: null,
        deposit: 500,
        monthlyRent: 40,
        note: null,
        createdAt: '2026-11-23T03:00:00Z',
        deliveredAgencyCount: 6,
        activeProposalCount: 0,
      },
    ],
  };

  it('lists recent requests with price, age and progress', () => {
    render(<DealRequestsPanel queue={dealRequests} now={now} />);
    expect(screen.getByRole('heading', { name: /최근 내놓기·구하기 요청/ })).toHaveTextContent('9');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('내놓기신대 레이크파크 1단지 · 34평 매매');
    expect(rows[0]).toHaveTextContent('희망가 4억 5,000 · 103동 고층 · 12분 전');
    expect(rows[0]).toHaveTextContent('배정 대기');
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute('href', '/deal-requests/d-1');
    expect(rows[1]).toHaveTextContent('구하기석현동 원룸·투룸 · 월세');
    expect(rows[1]).toHaveTextContent('보증금 500 · 월 40 이하 · 2시간 전');
    expect(rows[1]).toHaveTextContent('6곳 전달');
    expect(screen.getByRole('link', { name: /전체/ })).toHaveAttribute('href', '/deal-requests');
  });

  it('lists reported listings and the weekly handling note', () => {
    render(
      <ReportsPanel
        now={now}
        queue={{
          total: 3,
          handledThisWeek: 14,
          avgHandleHours: 5,
          items: [
            {
              id: 'r-1',
              targetType: 'LISTING',
              targetId: 'l-1',
              reason: 'WRONG_PRICE',
              title: '연향 센트럴 32평 매매 3억 1,000',
              agencyName: '연향센트럴 공인중개사사무소',
              reportCount: 2,
              lastReportedAt: '2026-11-23T04:40:00Z',
            },
          ],
        }}
      />,
    );
    const row = screen.getByRole('link', { name: /연향 센트럴 32평/ });
    expect(row).toHaveAttribute('href', '/reports/r-1');
    expect(row).toHaveTextContent('허위 가격');
    expect(row).toHaveTextContent('연향센트럴 공인중개사사무소 · 40분 전');
    expect(row).toHaveTextContent('신고 2건');
    expect(screen.getByText(/이번 주 처리/)).toHaveTextContent(
      '이번 주 처리 14건 · 평균 처리 5시간',
    );
  });

  it('opens an expiring ad in the banner / popup editor', () => {
    expect(adHref({ id: 'b 1', kind: 'BANNER' })).toBe('/banners?edit=b%201');
    expect(adHref({ id: 'p1', kind: 'POPUP' })).toBe('/banners/popups?edit=p1');
    render(
      <ExpiringAdsPanel
        now={now}
        queue={{
          total: 1,
          items: [
            {
              id: 'b1',
              kind: 'BANNER',
              advertiserName: '신대중앙 공인중개사사무소',
              slot: 'MAP_AD',
              placementLabel: '지도 플로팅 카드',
              endAt: '2026-11-26T14:59:59Z',
              ctr: 0.028,
              imageUrl: null,
            },
          ],
        }}
      />,
    );
    const row = screen.getByRole('link', { name: /신대중앙 공인중개사사무소/ });
    expect(row).toHaveAttribute('href', '/banners?edit=b1');
    expect(row).toHaveTextContent('D-3');
    expect(row).toHaveTextContent('지도 플로팅 카드 · 11.26 종료');
    expect(row).toHaveTextContent('클릭률 2.8%');
  });

  it('shows empty states', () => {
    const empty = { total: 0, items: [] };
    render(
      <>
        <DealRequestsPanel queue={empty} now={now} />
        <ReportsPanel queue={{ ...empty, handledThisWeek: 0, avgHandleHours: null }} now={now} />
        <ExpiringAdsPanel queue={empty} now={now} />
      </>,
    );
    expect(screen.getByText('진행 중인 요청이 없어요')).toBeInTheDocument();
    expect(screen.getByText('처리할 신고가 없어요')).toBeInTheDocument();
    expect(screen.getByText('7일 안에 끝나는 광고가 없어요')).toBeInTheDocument();
  });
});
