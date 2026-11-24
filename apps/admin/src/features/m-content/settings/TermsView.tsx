'use client';
import { TERMS_TYPE_LABEL, TermsType } from '@house/shared';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  Panel,
  Skeleton,
  StatusPill,
  useToast,
  type TableColumn,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage, qk } from '@/lib/api';
import { formatCount, formatDate, formatDateShort } from '@/lib/format';
import { terms } from '../api';
import { useDevQuery } from '../api/dev';
import type { TermsSummary } from '../api/schemas';
import { DataTable, cardStyles } from '../components/DataTable';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import {
  TERMS_STATE_LABEL,
  TERMS_STATE_TONE,
  compareVersions,
  daysUntil,
  termsState,
} from '../lib/terms';
import styles from './settings.module.css';

const TYPES = Object.values(TermsType);
const newHref = (type: TermsType, from?: string) =>
  `${ADMIN_ROUTES.terms}/new?type=${type}${from ? `&from=${from}` : ''}`;
const docHref = (id: string) => `${ADMIN_ROUTES.terms}/${id}`;

/** 약관·정책: every version per document type, newest first; drafts can be edited, published ones are read-only. */
export function TermsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [deleting, setDeleting] = useState<TermsSummary | null>(null);
  const list = useQuery({
    queryKey: qk('admin-terms', 'list', dev),
    queryFn: ({ signal }) => terms.list(dev, { signal }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => terms.remove(id),
    onSuccess: () => {
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-terms'] });
      toast('작성 중인 버전을 삭제했어요.');
    },
    onError: (e) => {
      setDeleting(null);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  const groups = useMemo(() => {
    const items = list.data?.items ?? [];
    return TYPES.map((type) => ({
      type,
      docs: items
        .filter((d) => d.type === type)
        .sort((a, b) => compareVersions(b.version, a.version)),
    }));
  }, [list.data]);

  const versionCell = (d: TermsSummary) => (
    <div className={s.cellMain}>
      <span className={s.cellTitle}>
        <Link href={docHref(d.id)} className={`${styles.version} ${styles.versionLink}`}>
          {d.version}
        </Link>
        <span className={s.clamp1}>{d.title}</span>
      </span>
    </div>
  );
  const statePill = (d: TermsSummary) => {
    const state = termsState(d);
    const left = daysUntil(d.effectiveAt);
    return (
      <StatusPill tone={TERMS_STATE_TONE[state]}>
        {TERMS_STATE_LABEL[state]}
        {state === 'scheduled' && left > 0 ? ` · D-${left}` : ''}
      </StatusPill>
    );
  };
  const actions = (d: TermsSummary) =>
    d.publishedAt ? (
      <span className={s.rowActions}>
        <IconButton
          label={`${d.title} ${d.version} 보기`}
          size={36}
          variant="plain"
          href={docHref(d.id)}
          linkAs={Link}
        >
          <Icon name="eye" size={18} />
        </IconButton>
      </span>
    ) : (
      <span className={s.rowActions}>
        <IconButton
          label={`${d.title} ${d.version} 수정`}
          size={36}
          variant="plain"
          href={docHref(d.id)}
          linkAs={Link}
        >
          <Icon name="edit" size={18} />
        </IconButton>
        <IconButton
          label={`${d.title} ${d.version} 삭제`}
          size={36}
          variant="plain"
          onClick={() => setDeleting(d)}
        >
          <Icon name="trash" size={18} />
        </IconButton>
      </span>
    );

  const columns: TableColumn<TermsSummary>[] = [
    { key: 'version', header: '버전 · 제목', cell: versionCell },
    { key: 'state', header: '상태', width: 150, cell: statePill },
    {
      key: 'effectiveAt',
      header: '적용일',
      width: 120,
      cell: (d) => <span className={s.num}>{formatDateShort(d.effectiveAt)}</span>,
    },
    {
      key: 'publishedAt',
      header: '게시일',
      width: 120,
      cell: (d) =>
        d.publishedAt ? (
          <span className={s.num}>{formatDateShort(d.publishedAt)}</span>
        ) : (
          <span className={s.muted}>게시 전</span>
        ),
    },
    {
      key: 'consents',
      header: '동의 회원',
      align: 'right',
      width: 110,
      cell: (d) =>
        d.consentCount === null ? (
          <span className={s.muted}>–</span>
        ) : (
          <span className={s.num}>{formatCount(d.consentCount)}명</span>
        ),
    },
    { key: 'actions', header: '관리', align: 'right', width: 96, cell: actions },
  ];

  return (
    <>
      <div className={s.bar}>
        <p className={`${s.muted} ${s.small}`}>
          게시한 버전은 고칠 수 없어요. 내용을 바꾸려면 새 버전을 작성해 게시해 주세요.
        </p>
        <div className={s.barEnd}>
          <Button
            href={`${ADMIN_ROUTES.terms}/new`}
            linkAs={Link}
            iconLeft={<Icon name="plus" size={18} />}
          >
            새 약관 작성
          </Button>
        </div>
      </div>

      {list.isError ? (
        <Panel>
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        </Panel>
      ) : list.isPending ? (
        Array.from({ length: 2 }, (_, i) => (
          <Panel key={i} title={<Skeleton height={20} width={120} />} flush>
            <div className={s.stack} style={{ padding: 20 }} aria-busy="true">
              <Skeleton height={20} width="70%" />
              <Skeleton height={20} width="56%" />
            </div>
          </Panel>
        ))
      ) : (
        groups.map(({ type, docs }) => {
          const current = docs.find((d) => d.isCurrent);
          const latest = docs[0];
          const hasDraft = docs.some((d) => !d.publishedAt);
          return (
            <Panel
              key={type}
              title={
                <span className={styles.termsHead}>
                  {TERMS_TYPE_LABEL[type]}
                  {latest && (
                    <Badge tone={latest.isRequired ? 'brand' : 'neutral'}>
                      {latest.isRequired ? '필수 동의' : '선택 동의'}
                    </Badge>
                  )}
                </span>
              }
              description={
                current
                  ? `${current.version} 버전 적용 중 · ${formatDate(current.effectiveAt)}부터`
                  : docs.length > 0
                    ? '적용 중인 버전이 없어요'
                    : undefined
              }
              flush
              actions={
                docs.length === 0 ? undefined : hasDraft ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled
                    title="작성 중인 버전이 이미 있어요"
                  >
                    새 버전 작성
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    href={newHref(type, (current ?? latest)?.id)}
                    linkAs={Link}
                  >
                    새 버전 작성
                  </Button>
                )
              }
            >
              <DataTable
                caption={`${TERMS_TYPE_LABEL[type]} 버전 목록`}
                columns={columns}
                rows={docs}
                rowKey={(d) => d.id}
                density="compact"
                empty={
                  <EmptyState
                    compact
                    icon="document"
                    title="아직 등록한 버전이 없어요"
                    description="첫 버전을 작성해 게시하면 회원 가입 화면에 보여요."
                    action={
                      <Button size="sm" href={newHref(type)} linkAs={Link}>
                        첫 버전 작성
                      </Button>
                    }
                  />
                }
                card={(d) => (
                  <>
                    <div className={cardStyles.cardRow}>
                      {versionCell(d)}
                      {statePill(d)}
                    </div>
                    <div className={cardStyles.cardRow}>
                      <div className={cardStyles.cardMeta}>
                        <span>적용 {formatDateShort(d.effectiveAt)}</span>
                        {d.consentCount !== null && (
                          <span>동의 {formatCount(d.consentCount)}명</span>
                        )}
                      </div>
                      <div className={cardStyles.cardActions}>{actions(d)}</div>
                    </div>
                  </>
                )}
              />
            </Panel>
          );
        })
      )}

      <Callout size="sm" tone="muted">
        <strong>필수 약관</strong>의 새 버전이 적용되면 회원은 적용일 이후 처음 방문할 때 다시
        동의해요. 개정 내용은 적용일 전에 공지사항으로도 알려 주세요.
      </Callout>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="작성 중인 버전을 삭제할까요?"
        description={
          deleting
            ? `${deleting.title} ${deleting.version} 버전의 내용이 사라지고 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
