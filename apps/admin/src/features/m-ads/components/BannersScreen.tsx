'use client';
import { BannerStatus, type BannerSlot } from '@house/shared';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterDropdown,
  Icon,
  ListSearchField,
  Pagination,
  RadioGroup,
  useToast,
} from '@house/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage, qk } from '@/lib/api';
import {
  BANNER_PAGE_SIZE,
  BANNERS,
  useBannerList,
  useBannerTotals,
  useRegions,
  useBannerSlots,
  useDeleteBanner,
  usePopupList,
  useReorderBanners,
  useToggleBanner,
  type BannerListParams,
} from '../api/hooks';
import type { AdminBanner, AdminBannerPage } from '../api/schemas';
import { useUrlState } from '../hooks/useUrlState';
import { applyGroupOrder } from '../lib/reorder';
import { withRegionNames } from '../lib/summary';
import { isBannerSlot, slotLabel } from '../lib/slots';
import { displayCode, STATUS_FILTER_OPTIONS, STATUS_LABEL } from '../lib/status';
import styles from './ads.module.css';
import { AdsTabsBar } from './AdsTabsBar';
import { BannerEditor, type EditorMode } from './BannerEditor';
import { BannerTable, BannerTableSkeleton } from './BannerTable';
import { PopupQuickPanel } from './PopupQuickPanel';
import { SlotOverview } from './SlotOverview';
import { SlotSpecModal } from './SlotSpecModal';

const isStatus = (value: string | null): value is BannerStatus =>
  !!value && (Object.values(BannerStatus) as string[]).includes(value);

type EditorTarget = { mode: EditorMode; id: string | null } | null;
type UrlPatch = Record<string, string | number | null>;

const CLOSED: UrlPatch = { edit: null, copy: null, new: null };

/** 배너 tab: slot overview, sortable banner list with filters, popup quick settings and the edit drawer. */
export function BannersScreen() {
  const { params, set, hrefWith } = useUrlState();
  const { toast } = useToast();
  const client = useQueryClient();

  const slotParam = params.get('slot');
  const statusParam = params.get('status');
  const slot = isBannerSlot(slotParam) ? slotParam : null;
  const status = isStatus(statusParam) ? statusParam : null;
  const q = (params.get('q') ?? '').trim();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const editId = params.get('edit');
  const copyId = params.get('copy');
  const editor: EditorTarget = editId
    ? { mode: 'edit', id: editId }
    : copyId
      ? { mode: 'copy', id: copyId }
      : params.get('new')
        ? { mode: 'new', id: null }
        : null;

  const listParams: BannerListParams = {
    slot: slot ?? undefined,
    status: status ?? undefined,
    q: q || undefined,
    page,
    pageSize: BANNER_PAGE_SIZE,
  };
  const list = useBannerList(listParams);
  const slots = useBannerSlots();
  const popups = usePopupList();
  const toggle = useToggleBanner();
  const remove = useDeleteBanner();
  const reorder = useReorderBanners();

  const [specOpen, setSpecOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);
  const [pendingNav, setPendingNav] = useState<UrlPatch | null>(null);
  const [announce, setAnnounce] = useState('');
  const [slotDraft, setSlotDraft] = useState<string>('');
  const [statusDraft, setStatusDraft] = useState<string>('');
  const dirty = useRef(false);
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  /** Changes the editor target; asks first when the open form has unsaved edits. */
  const navigateEditor = (patch: UrlPatch) => {
    if (dirty.current) setPendingNav(patch);
    else set(patch, { push: true });
  };
  const closeEditor = (focusId?: string | null) => {
    dirty.current = false;
    set(CLOSED);
    if (focusId)
      requestAnimationFrame(() => document.getElementById(`ads-edit-${focusId}`)?.focus());
  };

  const data = list.data;
  const rows = useMemo(() => data?.items ?? [], [data]);
  const totals = useBannerTotals(rows);
  const regionNames = useRegions(rows.some((b) => b.targetRegionCodes.length > 0));
  // The list view has neither counters nor region names: merge them in for the table.
  const tableRows = rows.map((b) => {
    const t = totals.get(b.id);
    return withRegionNames(t ? { ...b, ...t } : b, regionNames.data?.items);
  });
  const total = data?.total ?? 0;
  const first = data && total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(total, data.page * data.pageSize) : 0;
  const filtered = !!slot || !!status || !!q;
  const resetFilters = () => set({ slot: null, status: null, q: null, page: null });
  const bannerCount = slots.data?.every((s) => s.totalCount !== null)
    ? slots.data.reduce((sum, s) => sum + (s.totalCount ?? 0), 0)
    : !filtered
      ? data?.total
      : undefined;

  const onToggle = (banner: AdminBanner, paused: boolean) => {
    toggle.mutate(
      { id: banner.id, paused },
      {
        onSuccess: (saved) =>
          toast(
            `‘${banner.title}’ ${paused ? '노출을 중지했어요' : `· ${STATUS_LABEL[saved.status]} 상태예요`}`,
          ),
        onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
      },
    );
  };

  const onReorder = (change: {
    slot: BannerSlot;
    ids: string[];
    movedId: string;
    index: number;
  }) => {
    // Optimistic: reorder the rows on screen right away, then persist the full slot order. A list
    // refetch that is still in flight would paint the old order over it, so it is dropped first.
    void client.cancelQueries({ queryKey: [BANNERS, 'list'] });
    client.setQueryData<AdminBannerPage>(qk(BANNERS, 'list', listParams), (current) =>
      current ? { ...current, items: applyGroupOrder(current.items, change.ids) } : current,
    );
    const moved = rows.find((b) => b.id === change.movedId);
    setAnnounce(
      moved
        ? `‘${moved.title}’ 배너를 ${slotLabel(change.slot, slots.data)} ${change.index + 1}번째 줄로 옮겼어요`
        : '',
    );
    reorder.mutate(
      { slot: change.slot, visibleIds: change.ids },
      { onError: (e) => toast({ message: errorMessage(e), tone: 'error' }) },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    remove.mutate(target.id, {
      onSuccess: () => {
        toast(`‘${target.title}’ 배너를 삭제했어요`);
        setDeleting(null);
        if (editor?.id === target.id) closeEditor();
      },
      onError: (e) => {
        toast({ message: errorMessage(e), tone: 'error' });
        setDeleting(null);
      },
    });
  };

  const slotName = slot ? slotLabel(slot, slots.data) : '전체';
  const statsHref = (id: string) => `${ADMIN_ROUTES.banners}/${id}/stats`;

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <AdsTabsBar
          current="banners"
          bannerCount={bannerCount}
          popupCount={popups.data?.total}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Icon name="ruler" size={18} />}
                onClick={() => setSpecOpen(true)}
              >
                슬롯 규격표
              </Button>
              <Button
                size="sm"
                iconLeft={<Icon name="plus" size={18} />}
                onClick={() => navigateEditor({ ...CLOSED, new: 1 })}
              >
                새 배너 등록
              </Button>
            </>
          }
        />

        <SlotOverview
          slots={slots.data}
          loading={slots.isPending}
          error={slots.isError}
          onRetry={() => void slots.refetch()}
          selected={slot}
          hrefFor={(next) => hrefWith({ slot: next, page: null })}
        />

        <section className={styles.panel} aria-labelledby="ads-bl-h">
          <div className={styles.panelHd}>
            <div className={styles.panelHdText}>
              <h2 className={styles.panelT} id="ads-bl-h">
                배너 목록
              </h2>
              <span className={styles.cap}>같은 위치 안에서 끌어서 노출 순서를 바꿔요</span>
            </div>
            <div className={styles.filters}>
              <ListSearchField
                collapsible
                label="배너 검색"
                placeholder="광고주, 배너 ID 검색"
                value={q}
                onSearch={(next) => set({ q: next || null, page: null })}
              />
              <FilterDropdown
                field="노출 위치"
                valueLabel={slotName}
                active={!!slot}
                width={280}
                onOpen={() => setSlotDraft(slot ?? '')}
                onReset={() => setSlotDraft('')}
                onApply={() => set({ slot: slotDraft || null, page: null })}
              >
                <RadioGroup
                  label="노출 위치"
                  hideLabel
                  name="ads-slot"
                  direction="column"
                  className={styles.optList}
                  value={slotDraft}
                  onChange={setSlotDraft}
                  options={[
                    { value: '', label: '전체' },
                    ...(slots.data ?? []).map((s) => ({ value: s.slot, label: s.label })),
                  ]}
                />
              </FilterDropdown>
              <FilterDropdown
                field="상태"
                valueLabel={status ? STATUS_LABEL[status] : '전체'}
                active={!!status}
                width={220}
                onOpen={() => setStatusDraft(status ?? '')}
                onReset={() => setStatusDraft('')}
                onApply={() => set({ status: statusDraft || null, page: null })}
              >
                <RadioGroup
                  label="상태"
                  hideLabel
                  name="ads-status"
                  direction="column"
                  className={styles.optList}
                  value={statusDraft}
                  onChange={setStatusDraft}
                  options={[{ value: '', label: '전체' }, ...STATUS_FILTER_OPTIONS]}
                />
              </FilterDropdown>
              {filtered && (
                <button type="button" className={styles.reset} onClick={resetFilters}>
                  초기화
                </button>
              )}
            </div>
          </div>

          {list.isPending ? (
            <BannerTableSkeleton />
          ) : list.isError ? (
            <div className={styles.stateBox}>
              <ErrorState
                compact
                title="배너 목록을 불러오지 못했어요"
                onRetry={() => void list.refetch()}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.stateBox}>
              {filtered ? (
                <EmptyState
                  compact
                  icon="filter"
                  title="조건에 맞는 배너가 없어요"
                  description={
                    q
                      ? `‘${q}’에 맞는 배너가 없어요. 검색어나 조건을 바꿔 보세요.`
                      : '노출 위치나 상태 조건을 바꿔 보세요.'
                  }
                  action={
                    <Button variant="secondary" size="sm" onClick={resetFilters}>
                      조건 초기화
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon="megaphone"
                  title="등록된 배너가 없어요"
                  description="첫 배너를 등록하면 선택한 위치에 바로 노출할 수 있어요."
                  action={
                    <Button size="sm" onClick={() => navigateEditor({ ...CLOSED, new: 1 })}>
                      새 배너 등록
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <BannerTable
              rows={tableRows}
              slots={slots.data}
              editingId={editor?.mode === 'edit' ? editor.id : null}
              fetching={list.isPlaceholderData}
              busyIds={
                toggle.isPending && toggle.variables ? new Set([toggle.variables.id]) : undefined
              }
              onEdit={(b) => navigateEditor({ ...CLOSED, edit: b.id })}
              onDuplicate={(b) => navigateEditor({ ...CLOSED, copy: b.id })}
              onDelete={setDeleting}
              onToggle={onToggle}
              onReorder={onReorder}
              statsHref={statsHref}
            />
          )}

          {data && total > 0 && (
            <div className={styles.tfoot}>
              <span className={styles.cap}>
                {total}개 중{' '}
                <b>
                  {first}–{last}
                </b>{' '}
                · 노출 위치, 순서 기준
              </span>
              <Pagination
                className={styles.pager}
                page={data.page}
                totalPages={data.totalPages}
                onChange={(next) => set({ page: next > 1 ? next : null }, { push: true })}
              />
            </div>
          )}
        </section>

        <PopupQuickPanel />
      </div>

      <p className={styles.live} aria-live="polite">
        {announce}
      </p>

      {editor && (
        <BannerEditor
          mode={editor.mode}
          bannerId={editor.id}
          initialSlot={slot ?? undefined}
          slots={slots.data}
          onClose={() => closeEditor(editor.mode === 'edit' ? editor.id : null)}
          onSaved={(saved) => closeEditor(saved.id)}
          onDelete={setDeleting}
          onDirtyChange={onDirtyChange}
          statsHref={statsHref}
        />
      )}

      <SlotSpecModal open={specOpen} onClose={() => setSpecOpen(false)} slots={slots.data} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        danger
        loading={remove.isPending}
        title="배너를 삭제할까요?"
        description={
          deleting
            ? `${displayCode(deleting)} ‘${deleting.title}’ 배너와 노출·클릭 통계가 함께 삭제되고, 되돌릴 수 없어요. 잠시 내리려면 ‘중지’를 쓰세요.`
            : undefined
        }
        confirmLabel="삭제"
      />
      <ConfirmDialog
        open={!!pendingNav}
        onClose={() => setPendingNav(null)}
        onConfirm={() => {
          if (pendingNav) {
            dirty.current = false;
            set(pendingNav, { push: true });
          }
          setPendingNav(null);
        }}
        title="편집 중인 내용을 버릴까요?"
        description="저장하지 않은 변경사항이 있어요."
        confirmLabel="버리고 이동"
        cancelLabel="계속 편집"
      />
    </div>
  );
}
