'use client';
import { AUTH_PROVIDER_LABEL, AuthProvider } from '@house/shared';
import { ProviderTile, cx } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { AdminShell, SidebarStatusCard } from '@/components/shell';
import {
  DASHBOARD_REFRESH_MS,
  coreKeys,
  fetchDashboardSummary,
  type DashboardSummary,
} from '../../api';
import { GlobalSearch } from '../search/GlobalSearch';
import styles from './ConsoleShell.module.css';
import { SessionWatcher } from './SessionWatcher';

const ORDER: readonly AuthProvider[] = [
  AuthProvider.KAKAO,
  AuthProvider.NAVER,
  AuthProvider.GOOGLE,
];

function SocialLoginStatus({ providers }: { providers: DashboardSummary['socialLogin'] }) {
  if (providers.length === 0) return null;
  const known = ORDER.map((p) => providers.find((x) => x.provider === p)).filter((x) => !!x);
  const allOk = known.every((p) => p.enabled && p.healthy);
  return (
    <SidebarStatusCard
      title="간편 로그인 연동"
      status={allOk ? '정상' : '점검 필요'}
      tone={allOk ? 'ok' : 'warn'}
    >
      <ul className={styles.sns}>
        {known.map((p) => {
          const state = !p.enabled ? '꺼짐' : p.healthy ? '연결됨' : '오류';
          const label = `${AUTH_PROVIDER_LABEL[p.provider]} ${state}`;
          return (
            <li
              key={p.provider}
              className={cx(!p.enabled && styles.off, p.enabled && !p.healthy && styles.bad)}
              title={label}
            >
              <ProviderTile provider={p.provider} size="md" label={label} />
            </li>
          );
        })}
      </ul>
    </SidebarStatusCard>
  );
}

export interface ConsoleShellProps {
  children: ReactNode;
  /** Counters fetched by the server layout (avoids badge pop-in on first paint). */
  initialSummary?: DashboardSummary | null;
}

/**
 * The admin shell wired to live data: sidebar queue badges, the bell count and the social-login
 * status card all come from GET /admin/dashboard (shared with the dashboard KPI row, refreshed
 * every 5 minutes). Also mounts the live topbar search and the session watcher.
 */
export function ConsoleShell({ children, initialSummary }: ConsoleShellProps) {
  const { data } = useQuery({
    queryKey: coreKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
    initialData: initialSummary ?? undefined,
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  return (
    <AdminShell
      badges={data?.badges}
      notificationCount={data?.notificationsUnread}
      sidebarFooter={data ? <SocialLoginStatus providers={data.socialLogin} /> : undefined}
      topbarSearch={
        // useSearchParams() inside: keep a boundary so a static shell could still be prerendered.
        <Suspense fallback={<span className={styles.searchFallback} aria-hidden="true" />}>
          <GlobalSearch />
        </Suspense>
      }
    >
      <SessionWatcher />
      {children}
    </AdminShell>
  );
}
