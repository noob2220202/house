'use client';
import { BannerStatus } from '@house/shared';
import {
  Button,
  ConfirmDialog,
  cx,
  EmptyState,
  ErrorState,
  FilterDropdown,
  Icon,
  RadioGroup,
  useToast,
} from '@house/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { errorMessage, qk } from '@/lib/api';
import { formatCount, formatPercent } from '@/lib/format';
import {
  POPUPS,
  useBannerSlots,
  useDeletePopup,
  usePatchPopup,
  usePopupList,
  useReorderPopups,
} from '../api/hooks';
import { mediaUrl, type AdminPopup, type AdminPopupPage } from '../api/schemas';
import { useRowDrag } from '../hooks/useRowDrag';
import { useUrlState } from '../hooks/useUrlState';
import { formatPeriodShort } from '../lib/dates';
import { dismissLabel, popupPagesLabel } from '../lib/popup-form';
import { applyGroupOrder } from '../lib/reorder';
import { ctrOf, displayCode, STATUS_FILTER_OPTIONS, STATUS_LABEL } from '../lib/status';
import { AdImage } from './AdImage';
import styles from './ads.module.css';
import { AdsTabsBar } from './AdsTabsBar';
import type { EditorMode } from './BannerEditor';
import { BannerTableSkeleton } from './BannerTable';
import { PopupEditor } from './PopupEditor';
import { StatusToggle } from './StatusToggle';

const isStatus = (value: string | null): value is BannerStatus =>
  !!value && (Object.values(BannerStatus) as string[]).includes(value);

type UrlPatch = Record<string, string | number | null>;
const CLOSED: UrlPatch = { edit: null, copy: null, new: null };
const idOf = (p: AdminPopup) => p.id;
const groupOf = () => 'popups';

/** 팝업 tab: sortable popup list with status toggles and the edit drawer. */
export function PopupsScreen() {
  const { params, set } = useUrlState();
  const { toast } = useToast();
  const client = useQueryClient();
  const statusParam = params.get('status');
  const status = isStatus(statusParam) ? statusParam : null;
  const editId = params.get('edit');
  const copyId = params.get('copy');
  const editor: { mode: EditorMode; id: string | null } | null = editId
    ? { mode: 'edit', id: editId }
    : copyId
      ? { mode: 'copy', id: copyId }
      : params.get('new')
        ? { mode: 'new', id: null }
        : null;

  const all = usePopupList();
  const list = usePopupList(status ?? undefined);
  const slots = useBannerSlots();
  const patch = usePatchPopup();
  const remove = useDeletePopup();
  const reorder = useReorderPopups();

  const [deleting, setDeleting] = useState<AdminPopup | null>(null);
  const [pendingNav, setPendingNav] = useState<UrlPatch | null>(null);
  const [statusDraft, setStatusDraft] = useState('');
  const [announce, setAnnounce] = useState('');
  const dirty = useRef(false);
  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  const navigateEditor = (next: UrlPatch) => {
    if (dirty.current) setPendingNav(next);
    else set(next, { push: true });
  };
  const closeEditor = (focusId?: string | null) => {
    dirty.current = false;
    set(CLOSED);
    if (focusId)
      requestAnimationFrame(() => document.getElementById(`ads-edit-${focusId}`)?.focus());
  };

  const rows = list.data?.items ?? [];
  const total = all.data?.total ?? 0;
  const bannerCount = slots.data?.every((s) => s.totalCount !== null)
    ? slots.data.reduce((sum, s) => sum + (s.totalCount ?? 0), 0)
    : undefined;

  const onCommit = useCallback(
    (change: { ids: string[]; movedId: string; index: number }) => {
      void client.cancelQueries({ queryKey: [POPUPS, 'list'] });
      client.setQueryData<AdminPopupPage>(
        qk(POPUPS, 'list', { status: status ?? null }),
        (current) =>
          current ? { ...current, items: applyGroupOrder(current.items, change.ids) } : current,
      );
      setAnnounce(`팝업을 ${change.index + 1}번째 줄로 옮겼어요`);
      reorder.mutate(
        { visibleIds: change.ids },
        { onError: (e) => toast({ message: errorMessage(e), tone: 'error' }) },
      );
    },
    [client, reorder, status, toast],
  );
  const { ordered, draggingId, rowRef, handleProps } = useRowDrag({
    rows,
    idOf,
    groupOf,
    onCommit,
  });

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    remove.mutate(target.id, {
      onSuccess: () => {
        toast(`‘${target.title}’ 팝업을 삭제했어요`);
        setDeleting(null);
        if (editor?.id === target.id) closeEditor();
      },
      onError: (e) => {
        toast({ message: errorMessage(e), tone: 'error' });
        setDeleting(null);
      },
    });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <AdsTabsBar
          current="popups"
          bannerCount={bannerCount}
          popupCount={all.data?.total}
          actions={
            <Button
              size="sm"
              iconLeft={<Icon name="plus" size={18} />}
              onClick={() => navigateEditor({ ...CLOSED, new: 1 })}
            >
              새 팝업 등록
            </Button>
          }
        />

        <section className={styles.panel} aria-labelledby="ads-pl-h">
          <div className={styles.panelHd}>
            <div className={styles.panelHdText}>
              <h2 className={styles.panelT} id="ads-pl-h">
                팝업 목록
              </h2>
              <span className={styles.cap}>
                같은 페이지에 여러 개가 걸리면 위에서부터 순서대로 보여요
              </span>
            </div>
            <div className={styles.filters}>
              <FilterDropdown
                field="상태"
                valueLabel={status ? STATUS_LABEL[status] : '전체'}
                active={!!status}
                width={220}
                onOpen={() => setStatusDraft(status ?? '')}
                onReset={() => setStatusDraft('')}
                onApply={() => set({ status: statusDraft || null })}
              >
                <RadioGroup
                  label="상태"
                  hideLabel
                  name="ads-popup-status"
                  direction="column"
                  className={styles.optList}
                  value={statusDraft}
                  onChange={setStatusDraft}
                  options={[{ value: '', label: '전체' }, ...STATUS_FILTER_OPTIONS]}
                />
              </FilterDropdown>
              {status && (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => set({ status: null })}
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {list.isPending ? (
            <BannerTableSkeleton rows={3} />
          ) : list.isError ? (
            <div className={styles.stateBox}>
              <ErrorState
                compact
                title="팝업 목록을 불러오지 못했어요"
                onRetry={() => void list.refetch()}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.stateBox}>
              {status ? (
                <EmptyState
                  compact
                  icon="filter"
                  title="조건에 맞는 팝업이 없어요"
                  action={
                    <Button variant="secondary" size="sm" onClick={() => set({ status: null })}>
                      조건 초기화
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon="megaphone"
                  title="등록된 팝업이 없어요"
                  description="공지나 이벤트를 팝업으로 알릴 수 있어요."
                  action={
                    <Button size="sm" onClick={() => navigateEditor({ ...CLOSED, new: 1 })}>
                      새 팝업 등록
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div className={cx(styles.tableWrap, list.isPlaceholderData && styles.fetching)}>
              <table className={styles.bt}>
                <caption className="sr-only">팝업 목록 · 노출 순서 기준 정렬</caption>
                <colgroup>
                  <col style={{ width: 52 }} />
                  <col />
                  <col style={{ width: 98 }} />
                  <col style={{ width: 108 }} />
                  <col style={{ width: 120 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">순서</th>
                    <th scope="col">팝업 · 노출 페이지 · 기간</th>
                    <th scope="col">상태</th>
                    <th scope="col" className={styles.r}>
                      노출 · 클릭 · CTR
                    </th>
                    <th scope="col" className={styles.r}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((p) => {
                    const name = `${displayCode(p)} ${p.title}`;
                    const editing = editor?.mode === 'edit' && editor.id === p.id;
                    const image = mediaUrl(p.media);
                    const notStarted = p.status === BannerStatus.SCHEDULED && p.impressions === 0;
                    return (
                      <tr
                        key={p.id}
                        ref={rowRef(p.id)}
                        className={cx(
                          editing && styles.editing,
                          draggingId === p.id && styles.dragging,
                          p.status === BannerStatus.ENDED && styles.ended,
                        )}
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.ord}
                            disabled={rows.length < 2}
                            aria-label={`${name} 순서 이동, ${p.sortOrder}번째. 위아래 화살표 키로 옮길 수 있어요`}
                            {...handleProps(p.id)}
                          >
                            <Icon name="drag" size={18} />
                            <span>{p.sortOrder}</span>
                          </button>
                        </td>
                        <td>
                          <div className={styles.bn}>
                            <span className={cx(styles.thumb, styles.thumbPopup)}>
                              {image && <AdImage src={image} alt="" sizes="58px" />}
                            </span>
                            <div className={styles.bnT}>
                              <p className={styles.bnTitle}>
                                <b title={p.title}>{p.title}</b>
                                {editing && <span className={styles.editingTag}>수정 중</span>}
                              </p>
                              <p className={styles.bnSub}>
                                <span className={styles.slotTag}>공지 팝업 {p.sortOrder}</span>
                                <span className={styles.bnAdv}>
                                  {popupPagesLabel(p.targetPages)}
                                </span>
                              </p>
                              <p className={styles.bnMeta}>
                                <span>
                                  <Icon name="calendar" size={14} />
                                  <span className="num">
                                    {formatPeriodShort(p.startAt, p.endAt)}
                                  </span>
                                </span>
                                <span>
                                  <Icon name="clock" size={14} />
                                  <span>{dismissLabel(p.dismissDays) || '닫기만 표시'}</span>
                                </span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusToggle
                            item={p}
                            name={name}
                            disabled={patch.isPending && patch.variables?.id === p.id}
                            onToggle={(paused) =>
                              patch.mutate(
                                { id: p.id, patch: { paused } },
                                {
                                  onSuccess: (saved) =>
                                    toast(
                                      `‘${p.title}’ ${paused ? '노출을 중지했어요' : `· ${STATUS_LABEL[saved.status]} 상태예요`}`,
                                    ),
                                  onError: (e) =>
                                    toast({ message: errorMessage(e), tone: 'error' }),
                                },
                              )
                            }
                          />
                        </td>
                        <td className={styles.r}>
                          <span className={styles.perfBox}>
                            {notStarted ? (
                              <>
                                <b className={cx(styles.perf, styles.perfNone)}>–</b>
                                <span className={styles.perfSub}>게시 전</span>
                              </>
                            ) : (
                              <>
                                <b className={styles.perf}>{formatCount(p.impressions)}</b>
                                <span className={styles.perfSub}>
                                  {formatCount(p.clicks)} ·{' '}
                                  {formatPercent(ctrOf(p.impressions, p.clicks))}
                                </span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className={styles.r}>
                          <span className={styles.acts}>
                            <button
                              type="button"
                              id={`ads-edit-${p.id}`}
                              className={cx(styles.act, editing && styles.actOn)}
                              aria-label={`${name} 수정`}
                              aria-pressed={editing}
                              onClick={() => navigateEditor({ ...CLOSED, edit: p.id })}
                            >
                              <Icon name="edit" size={18} />
                            </button>
                            <button
                              type="button"
                              className={styles.act}
                              aria-label={`${name} 복제`}
                              onClick={() => navigateEditor({ ...CLOSED, copy: p.id })}
                            >
                              <Icon name="copy" size={18} />
                            </button>
                            <button
                              type="button"
                              className={cx(styles.act, styles.actDel)}
                              aria-label={`${name} 삭제`}
                              onClick={() => setDeleting(p)}
                            >
                              <Icon name="trash" size={18} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {list.data && rows.length > 0 && (
            <div className={styles.tfoot}>
              <span className={styles.cap}>
                전체 <b>{rows.length}</b>개 · 노출 순서 기준 · 이미지 760 × 600
              </span>
            </div>
          )}
        </section>
      </div>

      <p className={styles.live} aria-live="polite">
        {announce}
      </p>

      {editor && (
        <PopupEditor
          mode={editor.mode}
          popupId={editor.id}
          count={total}
          onClose={() => closeEditor(editor.mode === 'edit' ? editor.id : null)}
          onSaved={(saved) => closeEditor(saved.id)}
          onDelete={setDeleting}
          onDirtyChange={onDirtyChange}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        danger
        loading={remove.isPending}
        title="팝업을 삭제할까요?"
        description={
          deleting
            ? `${displayCode(deleting)} ‘${deleting.title}’ 팝업이 삭제되고, 되돌릴 수 없어요. 잠시 내리려면 ‘중지’를 쓰세요.`
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
