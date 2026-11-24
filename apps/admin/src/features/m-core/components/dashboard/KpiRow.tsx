import { Delta, Icon, Skeleton, StatTile, cx, type IconName } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format';
import type { DashboardSummary } from '../../api';
import { deltaOf, formatDeltaPercent, type DeltaInfo } from '../../lib/dashboard';
import styles from './dashboard.module.css';

interface KpiProps {
  href: string;
  label: string;
  icon: IconName;
  /** Champagne icon tile for queues that need action. */
  attention?: boolean;
  value: number;
  unit: string;
  children: ReactNode;
}

/** One @house/ui StatTile (the tile the broker console dashboard uses too), linked to its page. */
function Kpi({ href, label, icon, attention, value, unit, children }: KpiProps) {
  const tile = (
    <StatTile
      className={styles.kpiTile}
      label={label}
      value={formatCount(value)}
      unit={unit}
      detail={children}
      icon={<Icon name={icon} size={18} />}
      iconTone={attention ? 'accent' : 'neutral'}
    />
  );
  return href.startsWith('#') ? (
    <a className={styles.kpiLink} href={href}>
      {tile}
    </a>
  ) : (
    <Link className={styles.kpiLink} href={href}>
      {tile}
    </Link>
  );
}

/** "▲ 8.6%" — for admin KPIs more is good (green); less follows the ▼ convention. */
export function Trend({
  delta,
  text,
  className,
}: {
  delta: DeltaInfo;
  text: string;
  className?: string;
}) {
  return (
    <Delta direction={delta.direction} good={delta.direction === 'up'} className={className}>
      {text}
    </Delta>
  );
}

export function KpiRow({ kpis }: { kpis: DashboardSummary['kpis'] }) {
  const visitors = deltaOf(kpis.visitors.today, kpis.visitors.yesterday);
  const { newListings, dealRequests } = kpis;
  const listings =
    newListings.yesterday === null ? null : deltaOf(newListings.today, newListings.yesterday);
  const pending = kpis.pendingAgencies;
  return (
    <section className={styles.kpis} aria-label="오늘의 핵심 지표">
      <Kpi
        href={ADMIN_ROUTES.stats}
        label="오늘 방문자"
        icon="eye"
        value={kpis.visitors.today}
        unit="명"
      >
        <Trend delta={visitors} text={formatDeltaPercent(visitors)} />
        어제 {formatCount(kpis.visitors.yesterday)}명
      </Kpi>
      <Kpi
        href={ADMIN_ROUTES.listings}
        label="신규 매물"
        icon="building"
        value={newListings.today}
        unit="건"
      >
        {listings && <Trend delta={listings} text={`${formatCount(listings.diff)}건`} />}
        {[
          listings ? '어제 대비' : null,
          newListings.pendingReview !== null
            ? `검수 대기 ${formatCount(newListings.pendingReview)}`
            : null,
          newListings.active !== null ? `광고 중 ${formatCount(newListings.active)}건` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Kpi>
      <Kpi
        href={ADMIN_ROUTES.dealRequests}
        label="내놓기·구하기 요청"
        icon="home-up"
        attention
        value={dealRequests.today}
        unit="건"
      >
        {dealRequests.sell !== null && dealRequests.find !== null && (
          <span className={styles.split}>
            <span className={cx(styles.rq, styles.sell)}>
              내놓기 {formatCount(dealRequests.sell)}
            </span>
            <span className={cx(styles.rq, styles.find)}>
              구하기 {formatCount(dealRequests.find)}
            </span>
          </span>
        )}
        {dealRequests.unassigned !== null
          ? `배정 대기 ${formatCount(dealRequests.unassigned)}`
          : dealRequests.open !== null
            ? `진행 중 ${formatCount(dealRequests.open)}건`
            : null}
      </Kpi>
      <Kpi
        href="#approvals"
        label="중개사 승인 대기"
        icon="shield"
        attention
        value={pending.count}
        unit="곳"
      >
        {pending.count === 0 ? (
          '대기 중인 신청이 없어요'
        ) : (
          <>
            {pending.oldestWaitingDays !== null && pending.oldestWaitingDays > 0 ? (
              <span className={styles.warnNote}>
                가장 오래된 신청 {formatCount(pending.oldestWaitingDays)}일째
              </span>
            ) : (
              <span>모두 오늘 신청</span>
            )}
            {pending.needsDocuments > 0 && `서류 보완 ${formatCount(pending.needsDocuments)}`}
          </>
        )}
      </Kpi>
    </section>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className={styles.kpis} aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <StatTile
          key={i}
          className={styles.kpiTile}
          label={<Skeleton width={96} height={14} />}
          value={<Skeleton width={110} height={30} />}
          detail={<Skeleton width="70%" height={14} />}
        />
      ))}
    </div>
  );
}
