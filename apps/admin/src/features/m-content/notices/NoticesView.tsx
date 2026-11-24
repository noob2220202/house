'use client';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  ListSearchField,
  Panel,
  SegmentedControl,
  Switch,
  useToast,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage, qk } from '@/lib/api';
import { formatCount, formatDateShort, formatRelativeTime } from '@/lib/format';
import { notices } from '../api';
import { useDevQuery } from '../api/dev';
import type { NoticeSummary, Page } from '../api/schemas';
import { DataTable, ListFooter, cardStyles } from '../components/DataTable';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import { useUrlState } from '../lib/use-url-state';

type Status = 'all' | 'published' | 'draft';
const PAGE_SIZE = 10;

export function NoticesView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [url, setUrl] = useUrlState({ q: '', status: 'all', page: '1' });
  const [deleting, setDeleting] = useState<NoticeSummary | null>(null);

  const params = {
    q: url.q,
    status: url.status === 'all' ? undefined : url.status,
    page: Number(url.page) || 1,
    pageSize: PAGE_SIZE,
    ...dev,
  };
  const list = useQuery({
    queryKey: qk('admin-notices', 'list', params),
    queryFn: ({ signal }) => notices.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-notices'] });

  const patch = useMutation({
    // Both flags travel together: a PATCH schema made with `noticeInputSchema.partial()` re-applies
    // their `.default(false)` in Zod 4, so pinning alone would unpublish the notice.
    mutationFn: (v: { row: NoticeSummary; body: { isPinned: boolean; isPublished: boolean } }) =>
      notices.update(v.row.id, v.body),
    // Flip the switch right away; the refetch after the call settles the real order / dates.
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: ['admin-notices', 'list'] });
      queryClient.setQueriesData<Page<NoticeSummary>>(
        { queryKey: ['admin-notices', 'list'] },
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((n) => (n.id === v.row.id ? { ...n, ...v.body } : n)),
              }
            : prev,
      );
    },
    onSettled: () => invalidate(),
    onSuccess: (_data, v) => {
      toast(
        v.body.isPublished !== v.row.isPublished
          ? v.body.isPublished
            ? '공지를 공개했어요.'
            : '공지를 비공개로 돌렸어요.'
          : v.body.isPinned
            ? '목록 맨 위에 고정했어요.'
            : '고정을 풀었어요.',
      );
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => notices.remove(id),
    onSuccess: () => {
      setDeleting(null);
      void invalidate();
      toast('공지를 삭제했어요.');
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const busyId = patch.isPending ? patch.variables.row.id : null;

  const titleCell = (n: NoticeSummary) => (
    <div className={s.cellMain}>
      <span className={s.cellTitle}>
        {n.isPinned && (
          <Icon name="bookmark" size={16} filled className={s.pinIcon} label="고정됨" />
        )}
        <Link href={`${ADMIN_ROUTES.notices}/${n.id}`} className={s.clamp1}>
          {n.title}
        </Link>
      </span>
      <span className={s.cellSub}>
        {n.createdByAdminName ?? '알 수 없음'} · {formatRelativeTime(n.updatedAt)} 수정
      </span>
    </div>
  );
  const publishSwitch = (n: NoticeSummary) => (
    <Switch
      checked={n.isPublished}
      disabled={busyId === n.id}
      onChange={(e) =>
        patch.mutate({ row: n, body: { isPublished: e.target.checked, isPinned: n.isPinned } })
      }
      aria-label={`${n.title} 공개`}
    >
      {n.isPublished ? '공개' : '비공개'}
    </Switch>
  );
  const pinSwitch = (n: NoticeSummary, label?: string) => (
    <Switch
      checked={n.isPinned}
      disabled={busyId === n.id || !n.isPublished}
      onChange={(e) =>
        patch.mutate({ row: n, body: { isPinned: e.target.checked, isPublished: n.isPublished } })
      }
      aria-label={`${n.title} 상단 고정`}
    >
      {label}
    </Switch>
  );
  const actions = (n: NoticeSummary) => (
    <span className={s.rowActions}>
      <IconButton
        label={`${n.title} 수정`}
        size={36}
        variant="plain"
        href={`${ADMIN_ROUTES.notices}/${n.id}`}
        linkAs={Link}
      >
        <Icon name="edit" size={18} />
      </IconButton>
      <IconButton
        label={`${n.title} 삭제`}
        size={36}
        variant="plain"
        onClick={() => setDeleting(n)}
      >
        <Icon name="trash" size={18} />
      </IconButton>
    </span>
  );

  const columns: TableColumn<NoticeSummary>[] = [
    { key: 'title', header: '제목 · 작성자', cell: titleCell },
    { key: 'status', header: '상태', width: 132, cell: publishSwitch },
    { key: 'pin', header: '상단 고정', width: 96, cell: (n) => pinSwitch(n) },
    {
      key: 'publishedAt',
      header: '게시일',
      width: 116,
      cell: (n) =>
        n.publishedAt ? (
          <span className={s.num}>{formatDateShort(n.publishedAt)}</span>
        ) : (
          <span className={s.muted}>–</span>
        ),
    },
    {
      key: 'views',
      header: '조회',
      align: 'right',
      width: 84,
      cell: (n) => <span className={s.num}>{formatCount(n.viewCount)}</span>,
    },
    { key: 'actions', header: '관리', align: 'right', width: 96, cell: actions },
  ];

  const data = list.data;
  const filtered = url.q !== '' || url.status !== 'all';

  return (
    <>
      <div className={s.bar}>
        <div className={s.filters}>
          <SegmentedControl<Status>
            label="공개 상태"
            size="sm"
            value={url.status as Status}
            onChange={(status) => setUrl({ status })}
            options={[
              { value: 'all', label: '전체' },
              { value: 'published', label: '공개' },
              { value: 'draft', label: '비공개' },
            ]}
          />
          <ListSearchField
            className={s.search}
            label="공지 제목·내용 검색"
            placeholder="제목, 내용 검색"
            value={url.q}
            onSearch={(q) => setUrl({ q })}
          />
        </div>
        <div className={s.barEnd}>
          <Button
            href={`${ADMIN_ROUTES.notices}/new`}
            linkAs={Link}
            iconLeft={<Icon name="plus" size={18} />}
          >
            새 공지 작성
          </Button>
        </div>
      </div>

      <Panel
        title="공지사항"
        count={data?.total}
        description="고정한 공지는 사용자 화면 목록 맨 위에 보여요"
        flush
        footer={
          data && data.total > 0 ? (
            <ListFooter
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPage={(page) => setUrl({ page: String(page) })}
              note="고정 · 최신순"
            />
          ) : undefined
        }
      >
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="공지사항 목록"
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(n) => n.id}
            loading={list.isPending}
            loadingRows={6}
            empty={
              filtered ? (
                <EmptyState
                  compact
                  title="조건에 맞는 공지가 없어요"
                  description="검색어나 상태를 바꿔 보세요."
                />
              ) : (
                <EmptyState
                  compact
                  icon="document"
                  title="아직 공지가 없어요"
                  description="서비스 소식과 점검 일정을 공지로 알려 보세요."
                  action={
                    <Button size="sm" href={`${ADMIN_ROUTES.notices}/new`} linkAs={Link}>
                      첫 공지 작성
                    </Button>
                  }
                />
              )
            }
            card={(n) => (
              <>
                {titleCell(n)}
                <div className={cardStyles.cardMeta}>
                  <span>
                    {n.publishedAt ? `${formatDateShort(n.publishedAt)} 게시` : '게시 전'}
                  </span>
                  <span>조회 {formatCount(n.viewCount)}</span>
                </div>
                <div className={cardStyles.cardRow}>
                  <span className={s.cardSwitches}>
                    {publishSwitch(n)}
                    {pinSwitch(n, '고정')}
                  </span>
                  <div className={cardStyles.cardActions}>{actions(n)}</div>
                </div>
              </>
            )}
          />
        )}
      </Panel>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="공지를 삭제할까요?"
        description={
          deleting
            ? `"${deleting.title}" 공지가 사용자 화면에서도 사라져요. 삭제한 공지는 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
