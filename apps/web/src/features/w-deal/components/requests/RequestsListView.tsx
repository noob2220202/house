import { DealRequestStatus, DealRequestType } from '@house/shared';
import { Button, Chip, EmptyState, ErrorState, Icon, Pagination, Tabs } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { DealRequestPage } from '../../api/schemas';
import { RequestCard } from './RequestCard';
import styles from './requests.module.css';

export type RequestTypeFilter = 'all' | 'sell' | 'find';
export type RequestStatusFilter = 'all' | 'open' | 'matched' | 'ended';

export const TYPE_PARAM: Record<Exclude<RequestTypeFilter, 'all'>, DealRequestType> = {
  sell: DealRequestType.SELL_OR_LEASE,
  find: DealRequestType.WANTED,
};
/** `status` query per chip — several statuses travel comma separated (the API's csv convention). */
export const STATUS_PARAM: Record<Exclude<RequestStatusFilter, 'all'>, string> = {
  open: DealRequestStatus.OPEN,
  matched: DealRequestStatus.MATCHED,
  ended: [DealRequestStatus.CLOSED, DealRequestStatus.CANCELLED, DealRequestStatus.EXPIRED].join(
    ',',
  ),
};

const STATUS_CHIPS: readonly { value: RequestStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'open', label: '제안 받는 중' },
  { value: 'matched', label: '중개사 선택 완료' },
  { value: 'ended', label: '종료' },
];

export function parseTypeFilter(value: string | undefined): RequestTypeFilter {
  return value === 'sell' || value === 'find' ? value : 'all';
}
export function parseStatusFilter(value: string | undefined): RequestStatusFilter {
  return value === 'open' || value === 'matched' || value === 'ended' ? value : 'all';
}

/** /me/requests href for a filter combination (defaults are omitted). */
export function requestsHref(
  type: RequestTypeFilter,
  status: RequestStatusFilter,
  page = 1,
): string {
  const sp = new URLSearchParams();
  if (type !== 'all') sp.set('type', type);
  if (status !== 'all') sp.set('status', status);
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${ROUTES.myRequests}?${qs}` : ROUTES.myRequests;
}

export const NewRequestActions = () => (
  <>
    <Button
      href={ROUTES.dealSell}
      linkAs={Link}
      size="sm"
      iconLeft={<Icon name="home-up" size={16} />}
    >
      내놓기
    </Button>
    <Button
      href={ROUTES.dealFind}
      linkAs={Link}
      size="sm"
      variant="secondary"
      iconLeft={<Icon name="home-search" size={16} />}
    >
      구하기
    </Button>
  </>
);

export interface RequestsListViewProps {
  type: RequestTypeFilter;
  status: RequestStatusFilter;
  /** null = the request failed. */
  data: DealRequestPage | null;
  errorCode?: string;
  /** Server "now" (ISO) so D-day labels match between server and client. */
  now: string;
}

/** Body of /me/requests: type tabs, status chips, request cards, pagination, empty / error states. */
export function RequestsListView({ type, status, data, errorCode, now }: RequestsListViewProps) {
  const filtered = type !== 'all' || status !== 'all';
  return (
    <>
      <Tabs
        label="요청 종류"
        linkAs={Link}
        value={type}
        items={[
          { value: 'all', label: '전체', href: requestsHref('all', status) },
          { value: 'sell', label: '내놓기', href: requestsHref('sell', status) },
          { value: 'find', label: '구하기', href: requestsHref('find', status) },
        ]}
      />
      <nav className={styles.filters} aria-label="진행 상태">
        {STATUS_CHIPS.map((chip) => (
          <Chip
            key={chip.value}
            href={requestsHref(type, chip.value)}
            linkAs={Link}
            selected={status === chip.value}
          >
            {chip.label}
          </Chip>
        ))}
      </nav>

      {data === null ? (
        <ErrorState
          className={styles.state}
          title="요청 목록을 불러오지 못했어요"
          code={errorCode}
          action={
            <Button href={requestsHref(type, status)} variant="secondary">
              다시 시도
            </Button>
          }
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          className={styles.state}
          icon={filtered ? 'filter' : 'home-up'}
          title={filtered ? '조건에 맞는 요청이 없어요' : '아직 등록한 요청이 없어요'}
          description={
            filtered
              ? '다른 종류나 진행 상태를 선택해 보세요.'
              : '집을 내놓거나 원하는 조건을 등록하면 순천 중개사무소가 먼저 제안해요.'
          }
          action={
            filtered ? (
              <Button href={ROUTES.myRequests} linkAs={Link} variant="secondary">
                전체 요청 보기
              </Button>
            ) : (
              <div className="row" style={{ justifyContent: 'center' }}>
                <NewRequestActions />
              </div>
            )
          }
        />
      ) : (
        <>
          <ul className={styles.list}>
            {data.items.map((request) => (
              <RequestCard key={request.id} request={request} now={now} />
            ))}
          </ul>
          {data.totalPages > 1 && (
            <div className={styles.pager}>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                linkAs={Link}
                hrefFor={(page) => requestsHref(type, status, page)}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
