'use client';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  LoadingRegion,
  Pagination,
  Panel,
  SegmentedControl,
  Skeleton,
  StatusPill,
  Tabs,
  cx,
  useToast,
} from '@house/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ConsolePage, ConsolePageHeader } from '@/features/a-agency/shell';
import { ApiError, errorMessage } from '@/lib/api';
import { formatCount, formatRelativeTime } from '@/lib/format';
import { fetchInquiries, inboxKeys, markAllInquiriesRead } from '../api/queries';
import type { Inquiry, InquiryStatusCounts } from '../api/schemas';
import {
  INQUIRY_CHANNEL_META,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  inquiryPreview,
  inquiryTitle,
  inquirySource,
  isInquiryUnread,
} from '../lib/inquiry';
import {
  DEFAULT_INQUIRY_FILTERS,
  inquiryFiltersToSearch,
  parseInquiryFilters,
  type InquiryChannelTab,
  type InquiryFilters,
  type InquiryStatusTab,
} from '../lib/params';
import ui from '../ui/inbox.module.css';
import { useDebouncedText } from '../ui/useDebouncedText';
import { scrollToListTop, useUrlState } from '../ui/useUrlState';
import { InquiryDrawer } from './InquiryDrawer';
import styles from './Inquiries.module.css';

const TABS_ID = 'agent-inquiries';

function statusTabs(counts: InquiryStatusCounts | undefined) {
  const total = counts ? counts.NEW + counts.IN_PROGRESS + counts.DONE : undefined;
  return [
    { value: 'all', label: '전체', count: total },
    { value: 'new', label: '새 문의', count: counts?.NEW },
    { value: 'progress', label: '응대 중', count: counts?.IN_PROGRESS },
    { value: 'done', label: '응대 완료', count: counts?.DONE },
  ] satisfies { value: InquiryStatusTab; label: string; count?: number }[];
}

function InquiryRow({ inquiry: i, onOpen }: { inquiry: Inquiry; onOpen: () => void }) {
  const unread = isInquiryUnread(i);
  const meta = INQUIRY_CHANNEL_META[i.channel];
  return (
    <li>
      <button
        type="button"
        className={cx(styles.row, unread && styles.rowUnread)}
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        <span className={cx(styles.channel, styles[`ch${i.channel}`])}>
          <Icon name={meta.icon} size={20} />
        </span>
        <span className={styles.rowMain}>
          <span className={styles.rowHead}>
            {unread && (
              <i className={styles.dot}>
                <span className="sr-only">읽지 않음</span>
              </i>
            )}
            <span className={styles.rowTitle}>{inquiryTitle(i)}</span>
            <time className={cx(styles.rowTime, 'only-lg')} dateTime={i.createdAt}>
              {formatRelativeTime(i.createdAt)}
            </time>
          </span>
          <span className={cx(styles.preview, !i.message && styles.previewAction)}>
            {inquiryPreview(i)}
          </span>
          <span className={cx(ui.meta, styles.metaLine)}>
            {/* Phones: the status pill takes the title line, so the time moves down here. */}
            <time className="only-sm" dateTime={i.createdAt}>
              {formatRelativeTime(i.createdAt)}
            </time>
            <span className={styles.source}>{inquirySource(i)}</span>
            {i.replies.length > 0 && <span>답변 {i.replies.length}</span>}
            {i.memo && <span>메모 있음</span>}
          </span>
        </span>
        <span className={styles.rowPill}>
          <StatusPill tone={INQUIRY_STATUS_TONE[i.status]}>
            {INQUIRY_STATUS_LABEL[i.status]}
          </StatusPill>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <LoadingRegion label="문의를 불러오는 중">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={ui.skeletonRow}>
          <Skeleton width={44} height={44} radius={12} />
          <span className={ui.skeletonText}>
            <Skeleton width="min(220px, 60%)" height={16} />
            <Skeleton width="min(460px, 90%)" height={14} />
            <Skeleton width="min(280px, 70%)" height={12} />
          </span>
        </div>
      ))}
    </LoadingRegion>
  );
}

/** /agent/inquiries — messages and contact actions on the office's listings, with status + memo. */
export function InquiriesView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useUrlState(parseInquiryFilters, inquiryFiltersToSearch);
  const { id: openId, ...listFilters } = filters;
  const query = useQuery({
    queryKey: inboxKeys.inquiryList(listFilters),
    queryFn: ({ signal }) => fetchInquiries(filters, signal),
    placeholderData: keepPreviousData,
    // An inbox is left open in a tab: pick up new inquiries when the agent comes back to it.
    refetchOnWindowFocus: true,
  });

  // Search box: typed text is committed to the URL after a short pause.
  const [search, setSearch] = useDebouncedText(filters.q, (q) =>
    setFilters({ ...filters, q, page: 1 }, { replace: true }),
  );

  const update = (patch: Partial<InquiryFilters>) => setFilters({ ...filters, page: 1, ...patch });
  const markAll = useMutation({
    mutationFn: markAllInquiriesRead,
    onSuccess: () => {
      toast('문의를 모두 읽음으로 표시했어요.');
      void queryClient.invalidateQueries({ queryKey: inboxKeys.inquiries });
      void queryClient.invalidateQueries({ queryKey: inboxKeys.dashboard });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });

  const data = query.data;
  const unreadCount = data?.unreadCount ?? 0;
  const narrowed = filters.channel !== 'all' || filters.unread || filters.q !== '';
  const resetFilters = () => {
    setSearch('');
    setFilters({ ...DEFAULT_INQUIRY_FILTERS, status: filters.status });
  };

  /*
   * The drawer lives in `?id=`. Opening it from a row pushes a history entry (back closes it);
   * closing it pops that entry again, so neither leaves a duplicate list entry behind. A drawer
   * that came with the URL (notification deep link, reload) has no entry of ours to pop: replace.
   */
  const openedHere = useRef(false);
  const openInquiry = (id: string) => {
    openedHere.current = true;
    setFilters({ ...filters, id });
  };
  const closeInquiry = () => {
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else {
      setFilters({ ...filters, id: null }, { replace: true });
    }
  };

  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow="고객"
        title="문의"
        description="매물과 사무소 페이지로 들어온 문의와 연락 기록이에요. 처리 상태와 메모를 남겨 팀과 함께 관리하세요."
        actions={
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Icon name="check" size={16} />}
            disabled={unreadCount === 0}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            모두 읽음
          </Button>
        }
      />

      <Panel flush>
        <Tabs
          className={ui.tabs}
          label="문의 처리 상태"
          idBase={TABS_ID}
          items={statusTabs(data?.statusCounts)}
          value={filters.status}
          onChange={(status) => update({ status })}
        />
        <div className={ui.toolbar}>
          <div className={ui.filters}>
            <SegmentedControl<InquiryChannelTab>
              label="문의 경로"
              size="sm"
              value={filters.channel}
              onChange={(channel) => update({ channel })}
              options={[
                { value: 'all', label: '전체' },
                { value: 'message', label: '메시지' },
                { value: 'call', label: '전화' },
                { value: 'sms', label: '문자' },
                { value: 'copy', label: '번호 복사' },
              ]}
            />
            <Chip selected={filters.unread} onClick={() => update({ unread: !filters.unread })}>
              안 읽음{unreadCount > 0 ? ` ${unreadCount}` : ''}
            </Chip>
          </div>
          <div className={cx(ui.toolbarEnd, styles.search)}>
            <Input
              aria-label="문의 검색"
              type="search"
              placeholder="매물·고객·메모 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<Icon name="search" size={18} />}
              autoComplete="off"
            />
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${TABS_ID}-panel-${filters.status}`}
          aria-labelledby={`${TABS_ID}-tab-${filters.status}`}
        >
          {query.isPending ? (
            <ListSkeleton />
          ) : query.isError ? (
            <ErrorState
              title="문의를 불러오지 못했어요"
              description={errorMessage(query.error)}
              onRetry={() => void query.refetch()}
              code={query.error instanceof ApiError ? query.error.requestId : undefined}
            />
          ) : data && data.items.length > 0 ? (
            <>
              <div className={ui.resultBar} aria-live="polite">
                <span>
                  <b>{formatCount(data.total)}</b>건{narrowed && ' · 필터 적용됨'}
                </span>
                {narrowed && (
                  <button type="button" className={ui.reset} onClick={resetFilters}>
                    <Icon name="refresh" size={14} />
                    필터 초기화
                  </button>
                )}
              </div>
              <ul className={cx(styles.list, query.isPlaceholderData && ui.stale)}>
                {data.items.map((i) => (
                  <InquiryRow key={i.id} inquiry={i} onOpen={() => openInquiry(i.id)} />
                ))}
              </ul>
              {data.totalPages > 1 && (
                <div className={ui.pager}>
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onChange={(page) => {
                      setFilters({ ...filters, page });
                      scrollToListTop();
                    }}
                  />
                </div>
              )}
            </>
          ) : narrowed ? (
            <EmptyState
              icon="filter"
              title="조건에 맞는 문의가 없어요"
              description="검색어나 필터를 바꿔 보세요."
              action={
                <Button variant="soft" size="sm" onClick={resetFilters}>
                  필터 초기화
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="chat"
              title={filters.status === 'all' ? '아직 문의가 없어요' : '해당 상태의 문의가 없어요'}
              description="고객이 매물에서 문의를 남기거나 전화·문자 버튼을 누르면 여기에 기록돼요."
            />
          )}
        </div>
      </Panel>

      <InquiryDrawer
        id={openId}
        seed={data?.items.find((i) => i.id === openId)}
        onClose={closeInquiry}
      />
    </ConsolePage>
  );
}
