'use client';
import { ErrorState, Icon, LoadingRegion } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import {
  DASHBOARD_REFRESH_MS,
  coreKeys,
  fetchDashboardQueues,
  fetchDashboardSummary,
} from '../../api';
import { dashboardCrumb } from '../../lib/dashboard';
import { DashPanel, PanelError, PanelRowsSkeleton } from './DashPanel';
import { KpiRow, KpiRowSkeleton } from './KpiRow';
import { PendingAgenciesPanel } from './PendingAgenciesPanel';
import {
  DealRequestsPanel,
  ExpiringAdsPanel,
  PendingSitesPanel,
  ReportsPanel,
} from './QueuePanels';
import { TrafficPanel } from './TrafficPanel';
import styles from './dashboard.module.css';

/** Below this width the topbar has no room for the "기준 · 5분마다 갱신" part of the crumb. */
const COMPACT_CRUMB_QUERY = '(max-width: 1180px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [query]);
  return matches;
}

export interface DashboardViewProps {
  /** The admin was bounced here from a page their role cannot open. */
  denied?: boolean;
}

/** Back-office home per AdminDashboard.dc.html. */
export function DashboardView({ denied = false }: DashboardViewProps) {
  const router = useRouter();
  const [showDenied, setShowDenied] = useState(denied);
  const compact = useMediaQuery(COMPACT_CRUMB_QUERY);
  const summary = useQuery({
    queryKey: coreKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
  const queues = useQuery({
    queryKey: coreKeys.queues(),
    queryFn: ({ signal }) => fetchDashboardQueues(signal),
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });

  const crumb = summary.data ? dashboardCrumb(summary.data.generatedAt) : null;
  // Relative labels ("12분 전", "3일째") are computed against the moment the data was fetched.
  const now = new Date(queues.dataUpdatedAt || Date.now());
  const q = queues.data;

  return (
    <div className={styles.dash}>
      <AdminPageHeader
        title="대시보드"
        crumb={crumb ? (compact ? [crumb[0]] : crumb) : undefined}
      />
      {showDenied && (
        <p className={styles.denied} role="status">
          <Icon name="lock" size={18} />
          요청한 메뉴는 현재 계정 권한으로 열 수 없어 대시보드로 이동했습니다.
          <button
            type="button"
            aria-label="안내 닫기"
            onClick={() => {
              setShowDenied(false);
              // drop ?denied=1 so a reload or a shared link does not show the notice again
              router.replace('/', { scroll: false });
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </p>
      )}

      {summary.data ? (
        <KpiRow kpis={summary.data.kpis} />
      ) : summary.isError ? (
        <div className={styles.panel}>
          <ErrorState
            compact
            title="핵심 지표를 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => void summary.refetch()}
          />
        </div>
      ) : (
        <LoadingRegion label="핵심 지표를 불러오는 중">
          <KpiRowSkeleton />
        </LoadingRegion>
      )}

      <div className={styles.grid}>
        <div className={styles.col}>
          <TrafficPanel />
          {q ? (
            <>
              <PendingAgenciesPanel
                total={q.pendingAgencies.total}
                items={q.pendingAgencies.items}
                now={now}
              />
              <PendingSitesPanel queue={q.pendingAgencySites} now={now} />
              <ExpiringAdsPanel queue={q.expiringAds} now={now} />
            </>
          ) : (
            <>
              <DashPanel id="approvals" title="승인 대기 중개사">
                {queues.isError ? (
                  <PanelError what="승인 대기 목록을" onRetry={() => void queues.refetch()} />
                ) : (
                  <PanelRowsSkeleton rows={4} />
                )}
              </DashPanel>
              <DashPanel id="site-requests" title="사무소 홈페이지 신청">
                {queues.isError ? (
                  <PanelError what="홈페이지 신청 목록을" onRetry={() => void queues.refetch()} />
                ) : (
                  <PanelRowsSkeleton rows={2} />
                )}
              </DashPanel>
              <DashPanel title="광고 만료 임박" grow>
                {queues.isError ? (
                  <PanelError what="만료 임박 광고를" onRetry={() => void queues.refetch()} />
                ) : (
                  <PanelRowsSkeleton rows={3} />
                )}
              </DashPanel>
            </>
          )}
        </div>
        <div className={styles.col}>
          {q ? (
            <>
              <DealRequestsPanel queue={q.dealRequests} now={now} />
              <ReportsPanel queue={q.reports} now={now} />
            </>
          ) : (
            <>
              <DashPanel title="최근 내놓기·구하기 요청">
                {queues.isError ? (
                  <PanelError what="요청 목록을" onRetry={() => void queues.refetch()} />
                ) : (
                  <PanelRowsSkeleton rows={5} tall />
                )}
              </DashPanel>
              <DashPanel title="신고 매물" grow>
                {queues.isError ? (
                  <PanelError what="신고 목록을" onRetry={() => void queues.refetch()} />
                ) : (
                  <PanelRowsSkeleton rows={3} tall />
                )}
              </DashPanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
