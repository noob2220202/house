'use client';
import { AgencyMemberRole, DEAL_REQUEST_TYPE_LABEL, DealRequestType } from '@house/shared';
import {
  Callout,
  DealBadge,
  Delta,
  EmptyState,
  ErrorState,
  Icon,
  LineChart,
  LoadingRegion,
  Panel,
  Skeleton,
  StatTile,
  StatusPill,
  Tag,
  cx,
  dealKindOf,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import type { SessionUser } from '@/lib/auth';
import {
  formatCount,
  formatDateShort,
  formatDday,
  formatDealPrice,
  formatMonthDay,
  formatPercent,
  formatRelativeTime,
} from '@/lib/format';
import { verificationState } from '@/features/a-listings/lib/status';
import { agencyKeys, fetchDashboard } from '../api/queries';
import type {
  AgencyDashboard,
  DashboardInquiry,
  DashboardListing,
  DashboardRequest,
  MyAgency,
} from '../api/schemas';
import { useMyAgency } from '../api/useMyAgency';
import { profileCompleteness } from '../lib/application';
import { AGENT_ROUTES } from '../nav';
import { ConsolePage, ConsolePageHeader } from '../shell';
import styles from './Dashboard.module.css';
import {
  inquiryPreview,
  inquirySource,
  inquiryTitle,
  isInquiryUnread,
} from '@/features/a-inbox/lib/inquiry';
import {
  requestAreaText,
  requestHeadlinePrice,
  requestTitle,
} from '@/features/a-inbox/lib/request-text';

function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.more}>
      {children}
      <Icon name="chevron-right" size={16} />
    </Link>
  );
}

function ddayTone(label: string): string | undefined {
  if (label === 'D-DAY' || label === '종료') return styles.ddayHot;
  const n = Number(label.replace('D-', ''));
  if (Number.isFinite(n) && n <= 3) return styles.ddayHot;
  if (Number.isFinite(n) && n <= 5) return styles.ddayWarm;
  return undefined;
}

function toneOfDays(days: number): string | undefined {
  if (days <= 3) return styles.ddayHot;
  if (days <= 5) return styles.ddayWarm;
  return undefined;
}

/** Ad expiry chip (D-n · D-DAY · 종료). */
function Dday({ date }: { date: string }) {
  const label = formatDday(date);
  return <span className={cx(styles.dday, ddayTone(label))}>{label}</span>;
}

/**
 * 실매물 확인 deadline chip — same wording as the listings page (a-listings `verificationState`):
 * "D-n" · "오늘 만료" · "n일 지남" (never "종료", which reads as an ended ad).
 */
function VerifyDue({ listing }: { listing: DashboardListing }) {
  const state = verificationState(listing);
  const days = state.daysLeft;
  return (
    <span
      className={cx(
        styles.dday,
        styles.ddayWide,
        days === null ? styles.ddayHot : toneOfDays(days),
      )}
    >
      {state.label}
    </span>
  );
}

function ListingRow({
  listing,
  chip,
  sub,
  action,
  href,
}: {
  listing: DashboardListing;
  chip: ReactNode;
  sub: string;
  action: string;
  href: string;
}) {
  return (
    <li className={styles.row}>
      {chip}
      <div className={styles.rowMain}>
        <p className={styles.rowTitle}>
          <DealBadge deal={dealKindOf(listing.dealType)} />
          <span>{listing.title}</span>
        </p>
        <p className={styles.rowSub}>{[listing.summary, sub].filter(Boolean).join(' · ')}</p>
      </div>
      <span className={styles.rowPrice}>{formatDealPrice(listing)}</span>
      <Link href={href} className={styles.rowAction}>
        {action}
        <span className="sr-only"> — {listing.title}</span>
        <Icon name="chevron-right" size={16} />
      </Link>
    </li>
  );
}

function RequestItem({ request }: { request: DashboardRequest }) {
  const sell = request.type === DealRequestType.SELL_OR_LEASE;
  const proposed = !!request.myProposal;
  const price = requestHeadlinePrice(request);
  const priceText = price ? `${price.label} ${price.value}` : null;
  return (
    <li>
      <Link href={AGENT_ROUTES.request(request.id)} className={styles.feedItem}>
        <span className={styles.feedHead}>
          <span className={cx(styles.chip, sell ? styles.chipSell : styles.chipWant)}>
            {DEAL_REQUEST_TYPE_LABEL[request.type]}
          </span>
          <span className={styles.feedTitle}>{requestTitle(request)}</span>
        </span>
        <span className={styles.feedMeta}>
          <span>
            {[priceText, requestAreaText(request), formatRelativeTime(request.createdAt)]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <StatusPill tone={proposed ? 'live' : 'review'}>
            {proposed ? '제안 완료' : '제안 전'}
          </StatusPill>
        </span>
      </Link>
    </li>
  );
}

function InquiryItem({ inquiry }: { inquiry: DashboardInquiry }) {
  return (
    <li>
      <Link href={AGENT_ROUTES.inquiry(inquiry.id)} className={styles.feedItem}>
        <span className={styles.feedHead}>
          {isInquiryUnread(inquiry) && (
            <i className={styles.unread}>
              <span className="sr-only">읽지 않음</span>
            </i>
          )}
          <span className={styles.feedTitle}>{inquiryTitle(inquiry)}</span>
          <span className={styles.time}>{formatRelativeTime(inquiry.createdAt)}</span>
        </span>
        <span className={styles.preview}>{inquiryPreview(inquiry)}</span>
        <span className={styles.feedMeta}>
          <span>{inquirySource(inquiry)}</span>
        </span>
      </Link>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <LoadingRegion label="대시보드를 불러오는 중">
      <div className={styles.kpis}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={108} radius={16} />
        ))}
      </div>
      <div className={styles.cols} style={{ marginTop: 20 }}>
        <div className={styles.col}>
          <Skeleton height={300} radius={16} />
          <Skeleton height={236} radius={16} />
        </div>
        <div className={styles.col}>
          <Skeleton height={330} radius={16} />
          <Skeleton height={220} radius={16} />
        </div>
      </div>
    </LoadingRegion>
  );
}

function ProfileCard({ agency }: { agency: MyAgency }) {
  const { done, total, missing } = profileCompleteness(agency);
  if (missing.length === 0) return null;
  const percent = Math.round((done / total) * 100);
  return (
    <Panel
      title="사무소 프로필 완성도"
      actions={<More href={AGENT_ROUTES.profile}>프로필 편집</More>}
    >
      <div className={styles.complete}>
        <p className={styles.completeHead}>
          <span>프로필을 채울수록 문의가 늘어요</span>
          <b>{percent}%</b>
        </p>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="프로필 완성도"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className={styles.missing}>
          {missing.map((m) => (
            <Tag key={m}>{m} 추가</Tag>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DashboardBody({ data, agency }: { data: AgencyDashboard; agency: MyAgency | null }) {
  const { listings, views, dealRequests, inquiries, expiringListings, verificationDue } = data;
  // The feed is truncated → the split comes from the aggregate; no chips when it is absent.
  const { newSellCount, newWantedCount } = dealRequests;
  const hasSplit = typeof newSellCount === 'number' && typeof newWantedCount === 'number';
  const firstDue = verificationDue
    .filter((l) => !!l.verificationDueAt)
    .sort((a, b) => (a.verificationDueAt ?? '').localeCompare(b.verificationDueAt ?? ''))[0];
  const firstDueState = firstDue ? verificationState(firstDue) : null;
  const change = views.changeRatio;

  return (
    <>
      <div className={styles.kpis}>
        <Link href={AGENT_ROUTES.listings} className={styles.kpiLink}>
          <StatTile
            className={styles.kpiTile}
            label="광고중 매물"
            value={formatCount(listings.active)}
            unit="건"
            icon={<Icon name="building" size={18} />}
            detail={
              <>
                계약중 {listings.reserved} · 작성중 {listings.draft} · 공동중개{' '}
                {listings.coBrokered}
              </>
            }
          />
        </Link>
        <Link href={AGENT_ROUTES.requests} className={styles.kpiLink}>
          <StatTile
            className={styles.kpiTile}
            label="새 내놓기·구하기"
            value={formatCount(dealRequests.newCount)}
            unit="건"
            icon={<Icon name="home-up" size={18} />}
            iconTone="brand"
            detail={
              dealRequests.newCount === 0 ? (
                '새 요청이 오면 알려 드려요'
              ) : hasSplit ? (
                <>
                  <span className={cx(styles.chip, styles.chipSell)}>내놓기 {newSellCount}</span>
                  <span className={cx(styles.chip, styles.chipWant)}>구하기 {newWantedCount}</span>
                </>
              ) : (
                '제안을 기다리는 요청이에요'
              )
            }
          />
        </Link>
        <Link href={AGENT_ROUTES.inquiries} className={styles.kpiLink}>
          <StatTile
            className={styles.kpiTile}
            label="읽지 않은 문의"
            value={formatCount(inquiries.unreadCount)}
            unit="건"
            icon={<Icon name="chat" size={18} />}
            detail={
              inquiries.unreadCount > 0 ? '빠르게 답할수록 계약률이 올라가요' : '모두 확인했어요'
            }
          />
        </Link>
        <Link href={AGENT_ROUTES.listingsVerifyDue} className={styles.kpiLink}>
          <StatTile
            className={styles.kpiTile}
            label="실매물 확인 필요"
            value={formatCount(verificationDue.length)}
            unit="건"
            icon={<Icon name="check-circle" size={18} />}
            iconTone="accent"
            detail={
              firstDueState ? (
                <span className={styles.warnText}>
                  {firstDueState.kind === 'overdue'
                    ? `기한 ${firstDueState.label}`
                    : `가장 빠른 기한 ${firstDueState.label}`}
                </span>
              ) : (
                '모든 매물이 확인되어 있어요'
              )
            }
          />
        </Link>
      </div>

      <div className={styles.cols}>
        <div className={styles.col}>
          <Panel title="매물 조회 추이" description="최근 7일 · 하루 단위">
            <div className={styles.views}>
              <dl className={styles.viewStats}>
                <div className={styles.viewStat}>
                  <dt>7일 매물 조회</dt>
                  <dd>
                    {formatCount(views.total7d)}
                    {change !== null && (
                      <Delta
                        direction={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}
                        good={change > 0}
                      >
                        {formatPercent(Math.abs(change))}
                      </Delta>
                    )}
                  </dd>
                </div>
                <div className={styles.viewStat}>
                  <dt>사무소 페이지 조회</dt>
                  <dd>{formatCount(views.profileViews7d)}</dd>
                </div>
                <div className={styles.viewStat}>
                  <dt>관심 등록</dt>
                  <dd>
                    {formatCount(views.favorites7d)}
                    <small>건</small>
                  </dd>
                </div>
              </dl>
              <LineChart
                label="최근 7일 매물 조회수"
                className={styles.chart}
                height={220}
                zeroBased
                labels={views.daily.map((d) => formatMonthDay(d.date))}
                series={[
                  { name: '매물 조회', values: views.daily.map((d) => d.views), area: true },
                ]}
                formatY={(v) => formatCount(v)}
              />
            </div>
          </Panel>

          <Panel
            title="광고 만료 임박"
            count={expiringListings.length || undefined}
            description={
              <span className={styles.panelDesc}>
                만료 전에 매물 정보를 확인하고 기간을 관리해 주세요
              </span>
            }
            actions={<More href={AGENT_ROUTES.listings}>매물 관리</More>}
            flush
          >
            {expiringListings.length === 0 ? (
              <EmptyState
                compact
                icon="calendar"
                title="7일 안에 만료되는 매물이 없어요"
                description="광고 기간이 끝나기 전에 여기서 알려 드려요."
              />
            ) : (
              <ul className={styles.rows}>
                {expiringListings.map((l) => (
                  <ListingRow
                    key={l.id}
                    listing={l}
                    chip={<Dday date={l.expiresAt ?? ''} />}
                    sub={l.expiresAt ? `${formatMonthDay(l.expiresAt)} 종료` : ''}
                    action="매물 보기"
                    href={AGENT_ROUTES.listingEdit(l.id)}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="실매물 확인이 필요한 매물"
            count={verificationDue.length || undefined}
            description={
              <span className={styles.panelDesc}>
                기한 안에 다시 확인하면 ‘실매물 확인’ 표시가 유지돼요
              </span>
            }
            actions={<More href={AGENT_ROUTES.listingsVerifyDue}>전체</More>}
            flush
          >
            {verificationDue.length === 0 ? (
              <EmptyState
                compact
                icon="check-circle"
                title="확인이 필요한 매물이 없어요"
                description="모든 광고중 매물의 실매물 확인이 최신이에요."
              />
            ) : (
              <ul className={cx(styles.rows, styles.rowsWide)}>
                {verificationDue.map((l) => (
                  <ListingRow
                    key={l.id}
                    listing={l}
                    chip={<VerifyDue listing={l} />}
                    href={AGENT_ROUTES.listingVerify(l.id)}
                    sub={
                      l.verifiedAt
                        ? `마지막 확인 ${formatDateShort(l.verifiedAt)}`
                        : '확인 기록 없음'
                    }
                    action="확인 기록"
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className={styles.col}>
          <Panel
            title="새 내놓기·구하기 요청"
            count={dealRequests.newCount || undefined}
            actions={<More href={AGENT_ROUTES.requests}>전체</More>}
            flush
          >
            {dealRequests.items.length === 0 ? (
              <EmptyState
                compact
                icon="home-up"
                title="아직 받은 요청이 없어요"
                description="우리 지역 내놓기·구하기 요청이 오면 여기에 보여요."
              />
            ) : (
              <ul className={styles.feed}>
                {dealRequests.items.map((r) => (
                  <RequestItem key={r.id} request={r} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="최근 문의"
            count={inquiries.unreadCount || undefined}
            actions={<More href={AGENT_ROUTES.inquiries}>전체</More>}
            flush
          >
            {inquiries.items.length === 0 ? (
              <EmptyState
                compact
                icon="chat"
                title="아직 문의가 없어요"
                description="매물에 문의가 들어오면 여기에 보여요."
              />
            ) : (
              <ul className={styles.feed}>
                {inquiries.items.map((q) => (
                  <InquiryItem key={q.id} inquiry={q} />
                ))}
              </ul>
            )}
          </Panel>

          {agency && agency.myRole === AgencyMemberRole.OWNER && <ProfileCard agency={agency} />}
        </div>
      </div>
    </>
  );
}

export interface DashboardViewProps {
  user: SessionUser;
}

/** /agent — console home: KPIs, views, expiring listings, 실매물 확인 reminders, requests, inquiries. */
export function DashboardView({ user }: DashboardViewProps) {
  const agencyQuery = useMyAgency();
  const dashboardQuery = useQuery({
    queryKey: agencyKeys.dashboard,
    queryFn: ({ signal }) => fetchDashboard(signal),
    staleTime: 60_000,
    retry: false,
  });
  const agency = agencyQuery.data ?? null;
  const name = user.name || user.nickname;
  const notApproved =
    dashboardQuery.error instanceof ApiError && dashboardQuery.error.code === 'AGENCY_NOT_APPROVED';

  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow={`${formatMonthDay(new Date(), true)} · ${agency?.name ?? '중개사 콘솔'}`}
        title={`${name}님, 안녕하세요`}
        description="오늘 확인할 요청과 매물을 한곳에 모았어요."
      />
      {dashboardQuery.isPending ? (
        <DashboardSkeleton />
      ) : notApproved ? (
        <Callout tone="warn" live title="승인된 중개사무소만 이용할 수 있어요">
          사무소 상태를 확인해 주세요.{' '}
          <Link href={AGENT_ROUTES.apply} className="link">
            등록 정보 보기
          </Link>
        </Callout>
      ) : dashboardQuery.isError ? (
        <Panel>
          <ErrorState
            compact
            title="대시보드를 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => void dashboardQuery.refetch()}
            code={
              dashboardQuery.error instanceof ApiError ? dashboardQuery.error.requestId : undefined
            }
          />
        </Panel>
      ) : (
        <DashboardBody data={dashboardQuery.data} agency={agency} />
      )}
    </ConsolePage>
  );
}
