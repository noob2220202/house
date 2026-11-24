'use client';
import { FaqCategory } from '@house/shared';
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  ListSearchField,
  Panel,
  Skeleton,
  Switch,
  cx,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { errorMessage, qk } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { faqs } from '../api';
import { useDevQuery } from '../api/dev';
import type { Faq, Page } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { OrderButtons } from '../components/OrderButtons';
import { RichPreview } from '../components/RichPreview';
import s from '../components/shared.module.css';
import { FAQ_CATEGORIES, FAQ_CATEGORY_LABEL } from '../lib/labels';
import { moveById } from '../lib/reorder';
import { useUrlState } from '../lib/use-url-state';
import { FaqDrawer } from './FaqDrawer';
import styles from './FaqsView.module.css';

type Editing = { mode: 'create'; category: FaqCategory } | { mode: 'edit'; faq: Faq } | null;

export function FaqsView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [url, setUrl] = useUrlState({ category: 'all', q: '' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);

  const key = qk('admin-faqs', 'list', dev);
  const list = useQuery({ queryKey: key, queryFn: ({ signal }) => faqs.list(dev, { signal }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
  const all = useMemo(() => list.data?.items ?? [], [list.data]);

  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const f of all) out.set(f.category, (out.get(f.category) ?? 0) + 1);
    return out;
  }, [all]);
  const needle = url.q.trim().toLowerCase();
  const groups = FAQ_CATEGORIES.filter((c) => url.category === 'all' || url.category === c)
    .map((category) => ({
      category,
      items: all
        .filter((f) => f.category === category)
        .filter(
          (f) =>
            !needle ||
            f.question.toLowerCase().includes(needle) ||
            f.answer.toLowerCase().includes(needle),
        ),
    }))
    .filter((g) => g.items.length > 0 || (!needle && url.category === g.category));

  const toggle = useMutation({
    mutationFn: (f: Faq) => faqs.update(f.id, { isPublished: !f.isPublished }),
    // Flip the switch right away; the refetch after the call settles the real state.
    onMutate: async (f) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Page<Faq>>(key, (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((x) =>
                x.id === f.id ? { ...x, isPublished: !f.isPublished } : x,
              ),
            }
          : prev,
      );
    },
    onSettled: () => invalidate(),
    onSuccess: (saved) => {
      toast(saved.isPublished ? 'FAQ를 공개했어요.' : 'FAQ를 비공개로 돌렸어요.');
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const reorder = useMutation({
    // Serial (one request at a time, in click order) so quick consecutive moves cannot land out of
    // order; the cache already holds the optimistic order, so success needs no refetch.
    scope: { id: 'admin-faqs-order' },
    mutationFn: (ids: string[]) => faqs.reorder(ids),
    onError: (e) => {
      toast({ message: errorMessage(e), tone: 'error' });
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => faqs.remove(id),
    onSuccess: () => {
      setDeleting(null);
      void invalidate();
      toast('FAQ를 삭제했어요.');
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });

  /** Optimistic move inside one category, then persist the category's new order. */
  const move = (faq: Faq, delta: -1 | 1) => {
    const inCategory = all.filter((f) => f.category === faq.category);
    const next = moveById(inCategory, faq.id, delta).map((f, i) => ({ ...f, sortOrder: i + 1 }));
    queryClient.setQueryData<Page<Faq>>(key, (prev) =>
      prev
        ? {
            ...prev,
            items: FAQ_CATEGORIES.flatMap((c) =>
              c === faq.category ? next : prev.items.filter((f) => f.category === c),
            ),
          }
        : prev,
    );
    reorder.mutate(next.map((f) => f.id));
  };

  const defaultCategory =
    url.category !== 'all' ? (url.category as FaqCategory) : FaqCategory.GENERAL;

  return (
    <>
      <div className={s.bar}>
        <div className={s.filters}>
          <div className={styles.chips} role="group" aria-label="분류">
            <Chip selected={url.category === 'all'} onClick={() => setUrl({ category: 'all' })}>
              전체<span className={styles.chipCount}>{all.length}</span>
            </Chip>
            {FAQ_CATEGORIES.map((c) => (
              <Chip key={c} selected={url.category === c} onClick={() => setUrl({ category: c })}>
                {FAQ_CATEGORY_LABEL[c]}
                <span className={styles.chipCount}>{counts.get(c) ?? 0}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className={s.barEnd}>
          <ListSearchField
            className={s.search}
            label="질문·답변 검색"
            placeholder="질문, 답변 검색"
            value={url.q}
            onSearch={(q) => setUrl({ q })}
          />
          <Button
            iconLeft={<Icon name="plus" size={18} />}
            onClick={() => setEditing({ mode: 'create', category: defaultCategory })}
          >
            FAQ 추가
          </Button>
        </div>
      </div>

      {list.isPending ? (
        <Panel title="FAQ" flush>
          <div className={s.stack} style={{ padding: 20 }} aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={22} width={`${78 - i * 9}%`} />
            ))}
          </div>
        </Panel>
      ) : list.isError ? (
        <Panel>
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        </Panel>
      ) : groups.length === 0 ? (
        <Panel>
          {all.length === 0 ? (
            <EmptyState
              compact
              icon="chat"
              title="아직 FAQ가 없어요"
              description="자주 받는 문의를 FAQ로 정리하면 고객센터 문의가 줄어요."
              action={
                <Button
                  size="sm"
                  onClick={() => setEditing({ mode: 'create', category: defaultCategory })}
                >
                  첫 FAQ 추가
                </Button>
              }
            />
          ) : (
            <EmptyState
              compact
              title="조건에 맞는 FAQ가 없어요"
              description="검색어나 분류를 바꿔 보세요."
            />
          )}
        </Panel>
      ) : (
        groups.map((group) => (
          <Panel
            key={group.category}
            title={FAQ_CATEGORY_LABEL[group.category]}
            count={group.items.length}
            description={
              needle ? '검색 중에는 순서를 바꿀 수 없어요' : '화살표로 노출 순서를 바꿔요'
            }
            flush
            actions={
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<Icon name="plus" size={16} />}
                onClick={() => setEditing({ mode: 'create', category: group.category })}
              >
                추가
              </Button>
            }
          >
            {group.items.length === 0 ? (
              <EmptyState compact icon="chat" title="이 분류에는 FAQ가 없어요" />
            ) : (
              <ul className={styles.list}>
                {group.items.map((faq, index) => {
                  const open = openId === faq.id;
                  return (
                    <li
                      key={faq.id}
                      className={cx(
                        styles.row,
                        !faq.isPublished && styles.rowOff,
                        open && styles.open,
                      )}
                    >
                      <OrderButtons
                        name={faq.question}
                        index={index}
                        count={group.items.length}
                        disabled={!!needle}
                        onMove={(delta) => move(faq, delta)}
                      />
                      <div className={styles.main}>
                        <button
                          type="button"
                          className={styles.question}
                          aria-expanded={open}
                          aria-controls={`faq-answer-${faq.id}`}
                          onClick={() => setOpenId(open ? null : faq.id)}
                        >
                          <span className={styles.q} aria-hidden="true">
                            Q
                          </span>
                          <span className={styles.qText}>{faq.question}</span>
                          <Icon name="chevron-down" size={18} className={styles.chev} />
                        </button>
                        {open && (
                          <div className={styles.answer} id={`faq-answer-${faq.id}`}>
                            <RichPreview source={faq.answer} compact />
                            <p className={styles.updated}>{formatDateShort(faq.updatedAt)} 수정</p>
                          </div>
                        )}
                      </div>
                      <div className={styles.controls}>
                        <Switch
                          checked={faq.isPublished}
                          disabled={toggle.isPending && toggle.variables.id === faq.id}
                          onChange={() => toggle.mutate(faq)}
                          aria-label={`${faq.question} 공개`}
                        >
                          <span className={styles.stateLabel}>
                            {faq.isPublished ? '공개' : '비공개'}
                          </span>
                        </Switch>
                        <span className={s.rowActions}>
                          <IconButton
                            label={`${faq.question} 수정`}
                            size={36}
                            variant="plain"
                            onClick={() => setEditing({ mode: 'edit', faq })}
                          >
                            <Icon name="edit" size={18} />
                          </IconButton>
                          <IconButton
                            label={`${faq.question} 삭제`}
                            size={36}
                            variant="plain"
                            onClick={() => setDeleting(faq)}
                          >
                            <Icon name="trash" size={18} />
                          </IconButton>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ))
      )}

      <FaqDrawer
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void invalidate();
        }}
        onDelete={(faq) => {
          setEditing(null);
          setDeleting(faq);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="FAQ를 삭제할까요?"
        description={
          deleting ? `"${deleting.question}" 항목이 사용자 화면에서도 사라져요.` : undefined
        }
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
