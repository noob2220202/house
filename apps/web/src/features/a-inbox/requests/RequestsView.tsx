'use client';
import { ASSET_TYPE_LABEL, AssetType } from '@house/shared';
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  FilterDropdown,
  Icon,
  LoadingRegion,
  Pagination,
  Panel,
  SegmentedControl,
  Skeleton,
  Tabs,
  cx,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ConsolePage, ConsolePageHeader } from '@/features/a-agency/shell';
import { SUNCHEON_REGIONS, regionSummary } from '@/features/w-deal/lib/regions';
import { ApiError, errorMessage } from '@/lib/api';
import { fetchAgencyRequests, inboxKeys } from '../api/queries';
import {
  DEFAULT_REQUEST_FILTERS,
  activeRequestFilterCount,
  parseRequestFilters,
  requestFiltersToSearch,
  type RequestFilters,
  type RequestSort,
  type RequestStageTab,
  type RequestTypeTab,
} from '../lib/params';
import ui from '../ui/inbox.module.css';
import { scrollToListTop, useUrlState } from '../ui/useUrlState';
import { RequestRow } from './RequestRow';
import styles from './Requests.module.css';
import { formatCount } from '@/lib/format';

const TABS_ID = 'agent-requests';
const ASSET_OPTIONS = Object.values(AssetType) as AssetType[];

/** Stage tabs, without counters: the API has no per-stage counts (only the list's `total`). */
const STAGE_TABS = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '새 요청' },
  { value: 'proposed', label: '응답 대기' },
  { value: 'accepted', label: '수락됨' },
  { value: 'ended', label: '종료' },
] satisfies { value: RequestStageTab; label: string }[];

interface CheckFilterProps<T extends string> {
  field: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: readonly T[];
  summary: string;
  onChange: (next: T[]) => void;
}

/** Multi-select filter chip (지역 / 매물 종류): draft inside the popover, committed on 적용. */
function CheckFilter<T extends string>({
  field,
  options,
  value,
  summary,
  onChange,
}: CheckFilterProps<T>) {
  const [draft, setDraft] = useState<T[]>([...value]);
  return (
    <FilterDropdown
      field={field}
      valueLabel={value.length > 0 ? summary : '전체'}
      active={value.length > 0}
      width={300}
      onOpen={() => setDraft([...value])}
      onReset={() => setDraft([])}
      onApply={() => onChange(draft)}
    >
      <ul className={styles.checks}>
        {options.map((o) => (
          <li key={o.value}>
            <Checkbox
              checked={draft.includes(o.value)}
              onChange={(e) =>
                setDraft((prev) =>
                  e.target.checked ? [...prev, o.value] : prev.filter((v) => v !== o.value),
                )
              }
            >
              {o.label}
              {o.hint && <small className={styles.checkHint}> {o.hint}</small>}
            </Checkbox>
          </li>
        ))}
      </ul>
    </FilterDropdown>
  );
}

function ListSkeleton() {
  return (
    <LoadingRegion label="요청을 불러오는 중">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={ui.skeletonRow}>
          <span className={ui.skeletonText}>
            <Skeleton width="min(320px, 70%)" height={18} />
            <Skeleton width="min(420px, 90%)" height={14} />
            <Skeleton width="min(260px, 60%)" height={12} />
          </span>
          <Skeleton width={96} height={24} className="only-lg" />
        </div>
      ))}
    </LoadingRegion>
  );
}

const EMPTY_COPY: Record<RequestStageTab, { title: string; description: string }> = {
  all: {
    title: '아직 받은 요청이 없어요',
    description: '우리 사무소 활동 지역에 내놓기·구하기 요청이 올라오면 여기에 모여요.',
  },
  new: {
    title: '새 요청을 모두 확인했어요',
    description: '제안하지 않은 요청이 없어요. 새 요청이 오면 알림으로 알려 드려요.',
  },
  proposed: {
    title: '응답을 기다리는 제안이 없어요',
    description: '새 요청에 제안을 보내면 요청자의 답을 여기서 기다릴 수 있어요.',
  },
  accepted: {
    title: '수락된 제안이 아직 없어요',
    description: '요청자가 제안을 수락하거나 연락처를 공개하면 여기에 모여요.',
  },
  ended: {
    title: '종료된 요청이 없어요',
    description: '마감·취소된 요청과 거절·철회된 제안이 여기에 정리돼요.',
  },
};

/** /agent/requests — 내놓기·구하기 requests that reach the agency, filterable by stage / type / region / asset. */
export function RequestsView() {
  const [filters, setFilters] = useUrlState(parseRequestFilters, requestFiltersToSearch);
  const query = useQuery({
    queryKey: inboxKeys.requestList(filters),
    queryFn: ({ signal }) => fetchAgencyRequests(filters, signal),
    placeholderData: keepPreviousData,
    // An inbox is left open in a tab: pick up new requests when the agent comes back to it.
    refetchOnWindowFocus: true,
  });

  const update = (patch: Partial<RequestFilters>) => setFilters({ ...filters, page: 1, ...patch });
  const narrowed = activeRequestFilterCount(filters) > 0;
  const data = query.data;
  const empty = EMPTY_COPY[filters.stage];

  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow="고객"
        title="내놓기·구하기 요청"
        description="우리 지역 고객이 올린 요청이에요. 연락처는 요청자가 공개에 동의한 뒤에 볼 수 있어요."
      />

      <Panel flush>
        <Tabs
          className={ui.tabs}
          label="요청 진행 단계"
          idBase={TABS_ID}
          items={STAGE_TABS}
          value={filters.stage}
          onChange={(stage) => update({ stage })}
        />
        <div className={ui.toolbar}>
          <div className={ui.filters}>
            <SegmentedControl<RequestTypeTab>
              label="요청 유형"
              size="sm"
              value={filters.type}
              onChange={(type) => update({ type })}
              options={[
                { value: 'all', label: '전체' },
                { value: 'sell', label: '내놓기' },
                { value: 'find', label: '구하기' },
              ]}
            />
            <CheckFilter
              field="지역"
              options={SUNCHEON_REGIONS.map((r) => ({
                value: r.code,
                label: r.name,
                hint: r.hint,
              }))}
              value={filters.regions}
              summary={regionSummary(filters.regions, 1)}
              onChange={(regions) => update({ regions })}
            />
            <CheckFilter<AssetType>
              field="매물 종류"
              options={ASSET_OPTIONS.map((a) => ({ value: a, label: ASSET_TYPE_LABEL[a] }))}
              value={filters.assets}
              summary={
                filters.assets.length > 1
                  ? `${ASSET_TYPE_LABEL[filters.assets[0]!]} 외 ${filters.assets.length - 1}`
                  : filters.assets[0]
                    ? ASSET_TYPE_LABEL[filters.assets[0]]
                    : ''
              }
              onChange={(assets) => update({ assets })}
            />
          </div>
          <div className={ui.toolbarEnd}>
            <label className="sr-only" htmlFor="agent-requests-sort">
              정렬
            </label>
            <select
              id="agent-requests-sort"
              className={ui.sort}
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as RequestSort })}
            >
              <option value="latest">최신순</option>
              <option value="expiring">마감 임박순</option>
            </select>
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${TABS_ID}-panel-${filters.stage}`}
          aria-labelledby={`${TABS_ID}-tab-${filters.stage}`}
        >
          {query.isPending ? (
            <ListSkeleton />
          ) : query.isError ? (
            <ErrorState
              title="요청을 불러오지 못했어요"
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
                  <button
                    type="button"
                    className={ui.reset}
                    onClick={() =>
                      setFilters({
                        ...DEFAULT_REQUEST_FILTERS,
                        stage: filters.stage,
                        sort: filters.sort,
                      })
                    }
                  >
                    <Icon name="refresh" size={14} />
                    필터 초기화
                  </button>
                )}
              </div>
              <ul className={cx(styles.list, query.isPlaceholderData && ui.stale)}>
                {data.items.map((r) => (
                  <RequestRow key={r.id} request={r} />
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
              title="조건에 맞는 요청이 없어요"
              description="지역이나 매물 종류 필터를 넓혀 보세요."
              action={
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() =>
                    setFilters({
                      ...DEFAULT_REQUEST_FILTERS,
                      stage: filters.stage,
                      sort: filters.sort,
                    })
                  }
                >
                  필터 초기화
                </Button>
              }
            />
          ) : (
            <EmptyState icon="home-up" title={empty.title} description={empty.description} />
          )}
        </div>
      </Panel>
    </ConsolePage>
  );
}
