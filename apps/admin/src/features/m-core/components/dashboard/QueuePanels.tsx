import { BANNER_SLOT_SPECS, DealRequestType } from '@house/shared';
import { Badge, EmptyState, Icon, StatusPill, cx } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ADMIN_ROUTES } from '@/config/nav';
import { formatCount, formatPercent, formatRelativeTime } from '@/lib/format';
import type { DashboardDealRequest, DashboardQueues, ExpiringAd } from '../../api';
import {
  REPORT_REASON_SHORT,
  adEndLabel,
  ddayInfo,
  dealRequestPrice,
  dealRequestStatus,
  dealRequestTitle,
} from '../../lib/dashboard';
import { DashPanel, PanelState } from './DashPanel';
import styles from './dashboard.module.css';

// ---------- 광고 만료 임박 ----------

/** Stand-in creative when a banner has no image (text-type map cards): three ink variations. */
function AdThumbArt({ variant }: { variant: number }) {
  const v = variant % 3;
  return (
    <svg viewBox="0 0 72 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="72" height="40" fill={v === 1 ? 'var(--ink-700)' : 'var(--ad-ground)'} />
      <rect
        x="7"
        y="12"
        width={v === 2 ? 28 : 26}
        height="4"
        rx="2"
        fill={v === 2 ? 'var(--ad-accent)' : '#fff'}
      />
      <rect
        x="7"
        y="20"
        width="18"
        height="3"
        rx="1.5"
        fill={v === 2 ? '#fff' : 'var(--ad-accent)'}
        opacity={v === 2 ? 0.8 : 1}
      />
      {v === 0 && (
        <>
          <rect x="46" y="8" width="20" height="32" fill="var(--ink-700)" />
          <rect x="50" y="12" width="4" height="4" fill="var(--ad-accent)" />
          <rect x="57" y="12" width="4" height="4" fill="var(--ink-600)" />
          <rect x="50" y="20" width="4" height="4" fill="var(--ink-600)" />
          <rect x="57" y="20" width="4" height="4" fill="var(--ad-accent)" />
        </>
      )}
      {v === 1 && (
        <>
          <path d="M44 40V18l10-8 10 8v22z" fill="var(--ink-600)" />
          <rect x="51" y="24" width="6" height="16" fill="var(--ad-accent)" />
        </>
      )}
      {v === 2 && (
        <>
          <rect x="40" y="14" width="8" height="26" fill="var(--ink-700)" />
          <rect x="50" y="6" width="9" height="34" fill="var(--ink-600)" />
          <rect x="61" y="18" width="8" height="22" fill="var(--ink-700)" />
          <circle cx="64" cy="9" r="3" fill="var(--ad-accent)" />
        </>
      )}
    </svg>
  );
}

/** Opens the ad in the banner / popup editor drawer (`?edit=<id>`), where the schedule is extended. */
export function adHref(ad: Pick<ExpiringAd, 'id' | 'kind'>): string {
  const list = ad.kind === 'POPUP' ? ADMIN_ROUTES.popups : ADMIN_ROUTES.banners;
  return `${list}?edit=${encodeURIComponent(ad.id)}`;
}

/** Only backend media paths go through the Next image optimiser (mock creatives are SVG routes). */
const optimizable = (src: string) => src.startsWith('/media/') && !/\.svg(\?|$)/i.test(src);

export function ExpiringAdsPanel({
  queue,
  now,
}: {
  queue: DashboardQueues['expiringAds'];
  now: Date;
}) {
  return (
    <DashPanel
      title="광고 만료 임박"
      count={queue.total}
      caption="종료 7일 전부터 광고주에게 연장 안내 알림이 나갑니다"
      more={{ label: '배너·팝업 관리', href: ADMIN_ROUTES.banners }}
      grow
    >
      {queue.items.length === 0 ? (
        <PanelState>
          <EmptyState
            compact
            icon="megaphone"
            title="7일 안에 끝나는 광고가 없어요"
            description="종료가 가까워진 배너·팝업이 이곳에 표시됩니다."
          />
        </PanelState>
      ) : (
        <ul className={styles.ads}>
          {queue.items.map((ad, i) => {
            const dday = ddayInfo(ad.endAt, now);
            const placement =
              ad.placementLabel ??
              (ad.slot ? BANNER_SLOT_SPECS[ad.slot].label : ad.kind === 'POPUP' ? '팝업' : '배너');
            return (
              <li key={ad.id}>
                <Link className={styles.adr} href={adHref(ad)}>
                  <span className={cx(styles.dday, styles[dday.tone])}>{dday.label}</span>
                  <span className={styles.thumb} aria-hidden="true">
                    {ad.imageUrl ? (
                      <Image
                        src={ad.imageUrl}
                        alt=""
                        fill
                        sizes="56px"
                        unoptimized={!optimizable(ad.imageUrl)}
                      />
                    ) : (
                      <AdThumbArt variant={i} />
                    )}
                  </span>
                  <span className={styles.adrN}>
                    <b>{ad.advertiserName}</b>
                    <span>
                      {placement} · {adEndLabel(ad)}
                    </span>
                  </span>
                  <span className={styles.adrC}>
                    {ad.ctr !== null && (
                      <>
                        클릭률 <b>{formatPercent(ad.ctr)}</b>
                      </>
                    )}
                  </span>
                  <span className={styles.ext}>
                    연장 처리
                    <Icon name="chevron-right" size={14} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashPanel>
  );
}

// ---------- 최근 내놓기·구하기 요청 ----------

function DealRequestRow({ item, now }: { item: DashboardDealRequest; now: Date }) {
  const sell = item.type === DealRequestType.SELL_OR_LEASE;
  const status = dealRequestStatus(item);
  return (
    <Link className={styles.li} href={`${ADMIN_ROUTES.dealRequests}/${item.id}`}>
      <span className={styles.liTop}>
        <span className={cx(styles.rq, sell ? styles.sell : styles.find)}>
          {sell ? '내놓기' : '구하기'}
        </span>
        <span className={styles.liT}>{dealRequestTitle(item)}</span>
      </span>
      <span className={styles.liM}>
        {dealRequestPrice(item).map((part, i) =>
          part.strong ? <b key={i}>{part.text}</b> : <span key={i}>{part.text}</span>,
        )}
        {item.note && ` · ${item.note}`} · {formatRelativeTime(item.createdAt, now)}
      </span>
      <span className={styles.liR}>
        <StatusPill tone={status.tone} className={styles.pill}>
          {status.label}
        </StatusPill>
      </span>
    </Link>
  );
}

export function DealRequestsPanel({
  queue,
  now,
}: {
  queue: DashboardQueues['dealRequests'];
  now: Date;
}) {
  return (
    <DashPanel
      title="최근 내놓기·구하기 요청"
      count={queue.total}
      more={{ label: '전체', href: ADMIN_ROUTES.dealRequests }}
    >
      {queue.items.length === 0 ? (
        <PanelState>
          <EmptyState
            compact
            icon="home-up"
            title="진행 중인 요청이 없어요"
            description="새 내놓기·구하기 요청이 접수되면 바로 보여 드려요."
          />
        </PanelState>
      ) : (
        <ul className={styles.list}>
          {queue.items.map((item) => (
            <li key={item.id}>
              <DealRequestRow item={item} now={now} />
            </li>
          ))}
        </ul>
      )}
    </DashPanel>
  );
}

// ---------- 신고 매물 ----------

export function ReportsPanel({ queue, now }: { queue: DashboardQueues['reports']; now: Date }) {
  return (
    <DashPanel
      title="신고 매물"
      count={queue.total}
      caption="24시간 안에 처리해 주세요"
      more={{ label: '신고 관리', href: ADMIN_ROUTES.reports }}
      grow
    >
      {queue.items.length === 0 ? (
        <PanelState>
          <EmptyState
            compact
            icon="check-circle"
            title="처리할 신고가 없어요"
            description="접수된 허위매물 신고를 모두 처리했습니다."
          />
        </PanelState>
      ) : (
        <ul className={styles.list}>
          {queue.items.map((report) => (
            <li key={report.id}>
              <Link className={styles.li} href={`${ADMIN_ROUTES.reports}/${report.id}`}>
                <span className={styles.liTop}>
                  <span className={styles.rp}>{REPORT_REASON_SHORT[report.reason]}</span>
                  <span className={styles.liT}>{report.title}</span>
                </span>
                <span className={styles.liM}>
                  {report.agencyName && `${report.agencyName} · `}
                  {formatRelativeTime(report.lastReportedAt, now)}
                </span>
                <span className={styles.liR}>
                  <Badge>신고 {formatCount(report.reportCount)}건</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        <Icon name="check-circle" size={16} />
        <span>
          이번 주 처리 <b>{formatCount(queue.handledThisWeek)}건</b>
          {queue.avgHandleHours !== null && (
            <>
              {' '}
              · 평균 처리 <b>{formatHours(queue.avgHandleHours)}</b>
            </>
          )}
        </span>
      </p>
    </DashPanel>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}분`;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}시간`;
}
