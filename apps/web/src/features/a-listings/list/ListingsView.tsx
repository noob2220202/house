'use client';
import {
  ASSET_TYPE_LABEL,
  AssetType,
  DEAL_TYPE_LABEL,
  DealType,
  LISTING_STATUS_LABEL,
  ListingStatus,
} from '@house/shared';
import {
  Button,
  Callout,
  Chip,
  ConfirmDialog,
  DealBadge,
  EmptyState,
  ErrorState,
  Icon,
  Pagination,
  PhotoPlaceholder,
  PremiumBadge,
  SearchField,
  Select,
  Skeleton,
  StatusPill,
  Table,
  Tabs,
  cx,
  photoKindForAsset,
  useToast,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMyAgency } from '@/features/a-agency/api/useMyAgency';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ConsolePage, ConsolePageHeader } from '@/features/a-agency/shell';
import { mediaImage } from '@/features/w-listing/lib/media';
import { errorMessage } from '@/lib/api';
import { formatCount, formatDateShort, formatDday } from '@/lib/format';
import {
  addVerification,
  changeListingStatus,
  deleteListing,
  fetchListings,
  fetchSummary,
  leaveCoBroker,
  listingKeys,
  type VerificationInput,
} from '../api/queries';
import type { AgencyListingItem } from '../api/schemas';
import { DEAL_KIND, priceText, rowLabel, rowTitle, specLine } from '../lib/display';
import {
  LIST_DEFAULTS,
  LIST_SORTS,
  LIST_SORT_LABEL,
  activeFilterCount,
  buildListQuery,
  parseListParams,
  type ListParams,
  type ListSort,
  type StatusTab,
} from '../lib/list-params';
import {
  STATUS_ACTION_LABEL,
  STATUS_TONE,
  commonTransitions,
  statusDoneText,
  verificationState,
} from '../lib/status';
import { CO_BROKER_ROUTE, editStepHref } from '../routes';
import { StatusDialog, VerifyDialog } from './dialogs';
import styles from './list.module.css';
import { RowMenu, type RowAction } from './RowMenu';

const TAB_ORDER: StatusTab[] = [
  'ALL',
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
  ListingStatus.DRAFT,
  ListingStatus.CLOSED,
  ListingStatus.HIDDEN,
];

const DAY = 86_400_000;
const expiringSoon = (row: AgencyListingItem) => {
  if (row.status !== ListingStatus.ACTIVE || !row.expiresAt) return false;
  const left = Date.parse(row.expiresAt) - Date.now();
  return left > 0 && left <= 7 * DAY;
};

function Thumb({ row }: { row: AgencyListingItem }) {
  return (
    <span className={styles.thumb}>
      {row.coverPhotoUrl ? (
        <Image {...mediaImage(row.coverPhotoUrl)} alt="" fill sizes="84px" loading="lazy" />
      ) : (
        <PhotoPlaceholder kind={photoKindForAsset(row.assetType)} />
      )}
    </span>
  );
}

function Tags({ row }: { row: AgencyListingItem }) {
  return (
    <>
      {!row.isPrimary && <span className={cx(styles.tag, styles.co)}>공동중개 참여</span>}
      {row.status === ListingStatus.DRAFT && !!row.missingCount && (
        <span className={cx(styles.tag, styles.todo)}>필수 {row.missingCount}개 남음</span>
      )}
    </>
  );
}

function PriceCell({ row }: { row: AgencyListingItem }) {
  const text = priceText(row);
  return (
    <span className={styles.price}>
      <DealBadge deal={DEAL_KIND[row.dealType]}>{DEAL_TYPE_LABEL[row.dealType]}</DealBadge>
      <span className={cx(styles.priceV, text === '가격 미입력' && styles.none)}>
        {text}
        {row.dealType === DealType.PRESALE && typeof row.premium === 'number' && (
          <PremiumBadge amount={row.premium} />
        )}
      </span>
    </span>
  );
}

function StatusCell({ row }: { row: AgencyListingItem }) {
  return (
    <span className={styles.status}>
      <StatusPill tone={STATUS_TONE[row.status]}>{LISTING_STATUS_LABEL[row.status]}</StatusPill>
      {row.status === ListingStatus.HIDDEN && row.hiddenReason && (
        <span className={styles.statusNote} title={row.hiddenReason}>
          <Icon name="alert" size={12} />
          운영팀 확인 중
        </span>
      )}
      {expiringSoon(row) && row.expiresAt && (
        <span className={styles.expire}>광고 만료 {formatDday(row.expiresAt)}</span>
      )}
    </span>
  );
}

function VerifyCell({ row }: { row: AgencyListingItem }) {
  const state = verificationState(row);
  const showDue =
    row.status === ListingStatus.DRAFT
      ? state.kind === 'none'
      : row.status !== ListingStatus.CLOSED;
  return (
    <span className={styles.verify}>
      <span className={styles.verifyDate}>
        {row.verifiedAt ? formatDateShort(row.verifiedAt) : '–'}
      </span>
      {showDue && (
        <span className={cx(styles.due, styles[state.kind])}>
          {state.kind === 'overdue' && <Icon name="alert" size={12} />}
          {state.kind === 'ok' ? `다음 확인 ${state.label}` : state.label}
        </span>
      )}
    </span>
  );
}

function Stats({ row }: { row: AgencyListingItem }) {
  return (
    <span className={styles.stats}>
      <span>
        조회 <b>{formatCount(row.viewCount)}</b>
      </span>
      <span className={styles.statsSub}>
        관심 {formatCount(row.favoriteCount)} · 문의 {formatCount(row.inquiryCount)}
      </span>
    </span>
  );
}

type Pending =
  | { kind: 'verify'; rows: AgencyListingItem[] }
  | { kind: 'status'; rows: AgencyListingItem[]; to: ListingStatus }
  | { kind: 'delete'; rows: AgencyListingItem[] }
  | { kind: 'leave'; rows: AgencyListingItem[] };

export interface ListingsViewProps {
  /** AGENCY_OWNER (co-brokerage join / leave is owner-only). */
  isOwner: boolean;
}

/** /agent/listings — the office's listings with status tabs, filters, bulk actions and reminders. */
export function ListingsView({ isOwner }: ListingsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = useMemo(() => parseListParams(searchParams), [searchParams]);
  const [search, setSearch] = useState(params.q);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);

  const update = (patch: Partial<ListParams>) => {
    const next = { ...params, page: 1, ...patch };
    setSelected([]);
    router.replace(`${pathname}${buildListQuery(next)}`, { scroll: false });
  };

  // Keep the search box in sync with back / forward navigation.
  useEffect(() => setSearch(params.q), [params.q]);
  // Debounced search-as-you-type.
  useEffect(() => {
    const term = search.trim();
    if (term === params.q) return;
    const t = setTimeout(() => update({ q: term }), 350);
    return () => clearTimeout(t);
    // Only the typed text triggers this effect (`update` is recreated on every render).
  }, [search]);

  const summary = useQuery({
    queryKey: listingKeys.summary,
    queryFn: ({ signal }) => fetchSummary(signal),
  });
  // The caller's office marks the rows it is the primary (대표) office of (API rows name it).
  const agencyId = useMyAgency().data?.id;
  const list = useQuery({
    queryKey: [...listingKeys.list(params), agencyId ?? null],
    queryFn: ({ signal }) => fetchListings(params, signal, agencyId),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const selectedRows = rows.filter((r) => selected.includes(r.id));
  const bulkTargets = commonTransitions(selectedRows);
  const filters = activeFilterCount(params);
  const counts = summary.data;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: listingKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['agencies', 'mine-dashboard'] });
  };

  /** Runs one request per row and reports "n건 완료 / m건 실패". */
  const runAll = async (
    targets: readonly AgencyListingItem[],
    run: (row: AgencyListingItem) => Promise<unknown>,
    doneText: (count: number) => string,
  ) => {
    setWorking(true);
    const results = await Promise.allSettled(targets.map(run));
    setWorking(false);
    setPending(null);
    setSelected([]);
    refresh();
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const ok = results.length - failed.length;
    if (failed.length === 0) toast({ message: doneText(ok) });
    else if (ok === 0) toast({ message: errorMessage(failed[0]?.reason), tone: 'error' });
    else
      toast({
        message: `${doneText(ok)} ${failed.length}건은 처리하지 못했어요: ${errorMessage(failed[0]?.reason)}`,
        tone: 'error',
        duration: 7000,
      });
  };

  const many = (n: number, single: string, plural: string) => (n === 1 ? single : plural);

  const confirmStatus = () => {
    if (pending?.kind !== 'status') return;
    const { rows: targets, to } = pending;
    void runAll(
      targets,
      (r) => changeListingStatus(r.id, to),
      (n) => statusDoneText(to, n),
    );
  };
  const confirmVerify = (input: VerificationInput) => {
    if (pending?.kind !== 'verify') return;
    void runAll(
      pending.rows,
      (r) => addVerification(r.id, input),
      (n) => many(n, '실매물 확인을 기록했어요.', `${n}건의 실매물 확인을 기록했어요.`),
    );
  };
  const confirmDelete = () => {
    if (pending?.kind !== 'delete') return;
    void runAll(
      pending.rows,
      (r) => deleteListing(r.id),
      (n) => many(n, '매물을 삭제했어요.', `${n}건을 삭제했어요.`),
    );
  };
  const confirmLeave = () => {
    if (pending?.kind !== 'leave') return;
    void runAll(
      pending.rows,
      (r) => leaveCoBroker(r.id),
      () => '공동중개에서 나왔어요.',
    );
  };

  const onRowAction = (row: AgencyListingItem, action: RowAction) => {
    if (action.type === 'verify') setPending({ kind: 'verify', rows: [row] });
    if (action.type === 'status') setPending({ kind: 'status', rows: [row], to: action.to });
    if (action.type === 'delete') setPending({ kind: 'delete', rows: [row] });
    if (action.type === 'leave') setPending({ kind: 'leave', rows: [row] });
  };

  const canEdit = (row: AgencyListingItem) => row.isPrimary && row.status !== ListingStatus.CLOSED;

  const columns: TableColumn<AgencyListingItem>[] = [
    {
      key: 'item',
      header: '매물',
      cell: (row) => (
        <span className={styles.item}>
          <Thumb row={row} />
          <span className={styles.itemT}>
            <span className={styles.itemName}>
              {canEdit(row) ? (
                <Link href={AGENT_ROUTES.listingEdit(row.id)}>{rowTitle(row)}</Link>
              ) : (
                <span>{rowTitle(row)}</span>
              )}
              <Tags row={row} />
            </span>
            <span className={styles.itemSub}>
              {[ASSET_TYPE_LABEL[row.assetType], specLine(row)].filter(Boolean).join(' · ')}
              {row.ho && (
                <span className={styles.ho} title="호수는 사무소 직원에게만 보여요">
                  <Icon name="lock" size={12} />
                  {row.ho}
                </span>
              )}
              {row.agencyCount > 1 && (
                <span className={styles.ho}>
                  <Icon name="users" size={12} />
                  중개사 {row.agencyCount}곳
                </span>
              )}
            </span>
          </span>
        </span>
      ),
    },
    { key: 'price', header: '거래 · 가격', cell: (row) => <PriceCell row={row} /> },
    { key: 'status', header: '상태', cell: (row) => <StatusCell row={row} /> },
    { key: 'verify', header: '실매물 확인', cell: (row) => <VerifyCell row={row} /> },
    { key: 'stats', header: '반응', cell: (row) => <Stats row={row} /> },
    {
      key: 'acts',
      header: '',
      headerLabel: '관리',
      align: 'right',
      cell: (row) => (
        <span className={styles.acts}>
          {canEdit(row) && (
            <Button
              href={AGENT_ROUTES.listingEdit(row.id)}
              linkAs={Link}
              variant="secondary"
              size="sm"
              aria-label={`${rowTitle(row)} ${row.status === ListingStatus.DRAFT ? '이어서 작성' : '수정'}`}
            >
              {row.status === ListingStatus.DRAFT ? '이어 쓰기' : '수정'}
            </Button>
          )}
          <RowMenu row={row} isOwner={isOwner} onAction={(a) => onRowAction(row, a)} />
        </span>
      ),
    },
  ];

  const tabs = TAB_ORDER.map((value) => ({
    value,
    label: value === 'ALL' ? '전체' : LISTING_STATUS_LABEL[value],
    count: counts ? (value === 'ALL' ? counts.total : counts.byStatus[value]) : undefined,
  }));

  const empty =
    filters > 0 || params.status !== 'ALL' ? (
      <EmptyState
        compact
        title="조건에 맞는 매물이 없어요"
        description="검색어나 필터를 바꿔 보세요."
        action={
          <Button variant="secondary" onClick={() => update({ ...LIST_DEFAULTS })}>
            필터 초기화
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon="building"
        title="아직 등록한 매물이 없어요"
        description="첫 매물을 등록하면 지도와 목록에 바로 노출돼요. 다른 사무소가 올린 매물에 공동중개로 참여할 수도 있어요."
        action={
          <>
            <Button
              href={AGENT_ROUTES.listingNew}
              linkAs={Link}
              iconLeft={<Icon name="plus" size={18} />}
            >
              매물 등록
            </Button>
            <Button href={CO_BROKER_ROUTE} linkAs={Link} variant="secondary">
              공동중개 매물 찾기
            </Button>
          </>
        }
      />
    );

  const deletable = selectedRows.length > 0 && selectedRows.every((r) => r.isPrimary);
  const verifiable =
    selectedRows.length > 0 && selectedRows.every((r) => r.status !== ListingStatus.CLOSED);
  const total = list.data?.total ?? 0;
  const loading = list.isPending;

  return (
    <ConsolePage width="wide">
      <ConsolePageHeader
        eyebrow="매물"
        title="매물 관리"
        description="우리 사무소가 등록했거나 공동중개로 참여한 매물이에요. 거래가 끝난 매물은 바로 ‘거래완료’로 바꿔 주세요."
        actions={
          <>
            <Button
              href={CO_BROKER_ROUTE}
              linkAs={Link}
              variant="secondary"
              iconLeft={<Icon name="users" size={18} />}
            >
              공동중개 매물 찾기
            </Button>
            <Button
              href={AGENT_ROUTES.listingNew}
              linkAs={Link}
              iconLeft={<Icon name="plus" size={18} />}
            >
              매물 등록
            </Button>
          </>
        }
      />

      {counts && counts.verificationDue > 0 && !params.due && (
        <Callout
          tone="warn"
          title={`실매물 확인이 필요한 매물이 ${counts.verificationDue}건 있어요`}
        >
          확인 기한이 지났거나 7일 안에 끝나요. 소유자에게 다시 확인한 뒤 기록해 주세요. 기한이 지난
          매물은 확인순 정렬에서 뒤로 밀려요.{' '}
          <button
            type="button"
            className="link"
            onClick={() => update({ status: 'ALL', due: true, sort: 'VERIFY_DUE' })}
          >
            확인이 필요한 매물만 보기
          </button>
        </Callout>
      )}

      <div className={styles.tabsRow}>
        <Tabs
          label="매물 상태"
          items={tabs}
          value={params.status}
          onChange={(status) => update({ status })}
        />
      </div>

      <section className={styles.panel} aria-label="매물 목록">
        <div className={styles.toolbar}>
          <SearchField
            variant="pill"
            className={styles.search}
            label="매물 검색"
            placeholder="단지·건물명, 주소, 동·호, 매물번호"
            value={search}
            onChange={setSearch}
            onSubmit={(value) => update({ q: value.trim() })}
          />
          <div className={styles.quick}>
            <Chip
              selected={params.due}
              onClick={() => update({ due: !params.due })}
              iconLeft={<Icon name="shield" size={16} />}
            >
              확인 필요{counts ? ` ${counts.verificationDue}` : ''}
            </Chip>
            <Chip
              selected={params.co}
              onClick={() => update({ co: !params.co })}
              iconLeft={<Icon name="users" size={16} />}
            >
              공동중개 참여{counts ? ` ${counts.coBrokered}` : ''}
            </Chip>
            {filters > 0 && (
              <button
                type="button"
                className={styles.reset}
                onClick={() => {
                  setSearch('');
                  update({ ...LIST_DEFAULTS, status: params.status });
                }}
              >
                <Icon name="refresh" size={14} />
                초기화
              </button>
            )}
          </div>
          <div className={styles.selects}>
            <Select
              aria-label="거래 형태"
              value={params.deal}
              onChange={(e) => update({ deal: e.target.value as DealType | '' })}
            >
              <option value="">거래 전체</option>
              {Object.values(DealType).map((d) => (
                <option key={d} value={d}>
                  {DEAL_TYPE_LABEL[d]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="매물 종류"
              value={params.asset}
              onChange={(e) => update({ asset: e.target.value as AssetType | '' })}
            >
              <option value="">종류 전체</option>
              {Object.values(AssetType).map((a) => (
                <option key={a} value={a}>
                  {ASSET_TYPE_LABEL[a]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="정렬"
              value={params.sort}
              onChange={(e) => update({ sort: e.target.value as ListSort })}
            >
              {LIST_SORTS.map((s) => (
                <option key={s} value={s}>
                  {LIST_SORT_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedRows.length > 0 && (
          <div className={styles.bulk} role="region" aria-label="선택한 매물 일괄 작업">
            <span className={styles.bulkN}>
              <b>{selectedRows.length}</b>건 선택
            </span>
            {bulkTargets.map((to) => (
              <Button
                key={to}
                size="sm"
                variant="secondary"
                onClick={() => setPending({ kind: 'status', rows: selectedRows, to })}
              >
                {STATUS_ACTION_LABEL[to]}
              </Button>
            ))}
            {verifiable && (
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Icon name="shield" size={16} />}
                onClick={() => setPending({ kind: 'verify', rows: selectedRows })}
              >
                실매물 확인 기록
              </Button>
            )}
            {deletable && (
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<Icon name="trash" size={16} />}
                onClick={() => setPending({ kind: 'delete', rows: selectedRows })}
              >
                삭제
              </Button>
            )}
            <span className={styles.bulkSpacer} />
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              선택 해제
            </Button>
          </div>
        )}

        {list.isError ? (
          <div className={styles.state}>
            <ErrorState
              title="매물 목록을 불러오지 못했어요"
              description={errorMessage(list.error)}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : (
          <>
            {!loading && total > 0 && (
              <p className={styles.count} role="status">
                <b>{formatCount(total)}</b>건{params.due && ' · 실매물 확인이 필요한 매물'}
                {params.co && ' · 공동중개로 참여한 매물'}
              </p>
            )}
            <div className={styles.tableWrap}>
              <Table
                bare
                caption="매물 목록"
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                selectable
                selectedKeys={selected}
                onSelectionChange={setSelected}
                loading={loading}
                loadingRows={6}
                empty={empty}
              />
            </div>

            <div className={styles.cards}>
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className={styles.card} aria-hidden="true">
                    <div className={styles.cardTop}>
                      <Skeleton width={84} height={64} radius={12} />
                      <div className={styles.cardT}>
                        <Skeleton width="70%" height={18} />
                        <Skeleton width="50%" height={14} />
                        <Skeleton width="40%" height={20} />
                      </div>
                    </div>
                  </div>
                ))
              ) : rows.length === 0 ? (
                <div className={styles.state}>{empty}</div>
              ) : (
                <ul>
                  {rows.map((row) => (
                    <li key={row.id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <Thumb row={row} />
                        <div className={styles.cardT}>
                          <span className={styles.cardMeta}>
                            <StatusCell row={row} />
                            <Tags row={row} />
                          </span>
                          <span className={styles.cardName}>{rowTitle(row)}</span>
                          <span className={styles.itemSub}>
                            {[ASSET_TYPE_LABEL[row.assetType], specLine(row)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                      </div>
                      <div className={styles.cardRow}>
                        <PriceCell row={row} />
                        <VerifyCell row={row} />
                      </div>
                      <div className={styles.cardRow}>
                        <Stats row={row} />
                        <span className={styles.dates}>
                          {row.updatedAt ? `${formatDateShort(row.updatedAt)} 수정` : ''}
                        </span>
                      </div>
                      <div className={styles.cardActs}>
                        {canEdit(row) ? (
                          <Button
                            href={AGENT_ROUTES.listingEdit(row.id)}
                            linkAs={Link}
                            variant="secondary"
                            size="sm"
                          >
                            {row.status === ListingStatus.DRAFT ? '이어 쓰기' : '수정'}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={row.status === ListingStatus.CLOSED}
                            onClick={() => setPending({ kind: 'verify', rows: [row] })}
                          >
                            실매물 확인 기록
                          </Button>
                        )}
                        {row.status === ListingStatus.DRAFT && row.isPrimary && (
                          <Button href={editStepHref(row.id, 'preview')} linkAs={Link} size="sm">
                            게시
                          </Button>
                        )}
                        <RowMenu
                          row={row}
                          isOwner={isOwner}
                          onAction={(a) => onRowAction(row, a)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(list.data?.totalPages ?? 1) > 1 && (
              <div className={styles.pager}>
                <Pagination
                  page={list.data?.page ?? 1}
                  totalPages={list.data?.totalPages ?? 1}
                  onChange={(page) => {
                    setSelected([]);
                    router.replace(`${pathname}${buildListQuery({ ...params, page })}`);
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>

      {pending?.kind === 'verify' && (
        <VerifyDialog
          open
          rows={pending.rows}
          loading={working}
          onClose={() => setPending(null)}
          onSubmit={confirmVerify}
        />
      )}
      <StatusDialog
        rows={pending?.kind === 'status' ? pending.rows : []}
        to={pending?.kind === 'status' ? pending.to : null}
        loading={working}
        onClose={() => setPending(null)}
        onConfirm={confirmStatus}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={confirmDelete}
        loading={working}
        danger
        title={
          pending?.kind === 'delete' && pending.rows.length > 1
            ? `매물 ${pending.rows.length}건을 삭제할까요?`
            : '매물을 삭제할까요?'
        }
        description={
          pending?.kind === 'delete' && (
            <>
              <b>
                {pending.rows.length === 1 && pending.rows[0]
                  ? rowLabel(pending.rows[0])
                  : `선택한 매물 ${pending.rows.length}건`}
              </b>
              <br />
              사진과 실매물 확인 기록까지 함께 지워지고 되돌릴 수 없어요. 거래가 끝난 매물이라면
              삭제 대신 ‘거래완료’로 바꿔 주세요.
            </>
          )
        }
        confirmLabel="삭제"
      />
      <ConfirmDialog
        open={pending?.kind === 'leave'}
        onClose={() => setPending(null)}
        onConfirm={confirmLeave}
        loading={working}
        danger
        title="공동중개에서 나갈까요?"
        description={
          pending?.kind === 'leave' &&
          pending.rows[0] && (
            <>
              <b>{rowLabel(pending.rows[0])}</b>
              <br />
              공개 페이지의 중개사무소 목록에서 우리 사무소가 빠져요. 매물은 최초 등록 사무소가 계속
              광고해요.
            </>
          )
        }
        confirmLabel="나가기"
      />
    </ConsolePage>
  );
}
