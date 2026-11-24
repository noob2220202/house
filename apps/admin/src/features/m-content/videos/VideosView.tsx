'use client';
import {
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  ListSearchField,
  Panel,
  Skeleton,
  Switch,
  Tag,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { errorMessage, qk } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { videos } from '../api';
import { useDevQuery } from '../api/dev';
import { regionLabel, useRegions } from '../api/regions';
import type { Page, Video } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { OrderButtons } from '../components/OrderButtons';
import s from '../components/shared.module.css';
import { moveById } from '../lib/reorder';
import { VideoDrawer } from './VideoDrawer';
import { VideoThumb } from './VideoThumb';
import styles from './VideosView.module.css';

export function VideosView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Video | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Video | null>(null);
  const regions = useRegions();

  const key = qk('admin-videos', 'list', dev);
  const list = useQuery({ queryKey: key, queryFn: ({ signal }) => videos.list(dev, { signal }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] });
  const all = useMemo(() => list.data?.items ?? [], [list.data]);
  const needle = search.trim().toLowerCase();
  const rows = needle
    ? all.filter(
        (v) =>
          v.title.toLowerCase().includes(needle) || v.description?.toLowerCase().includes(needle),
      )
    : all;
  const regionName = (code: string | null) => {
    const region = code ? regions.data?.find((r) => r.code === code) : undefined;
    return region ? regionLabel(region) : null;
  };

  const toggle = useMutation({
    mutationFn: (v: Video) => videos.update(v.id, { isPublished: !v.isPublished }),
    // Flip the switch right away; the refetch after the call settles the real state.
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Page<Video>>(key, (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((x) =>
                x.id === v.id ? { ...x, isPublished: !v.isPublished } : x,
              ),
            }
          : prev,
      );
    },
    onSettled: () => invalidate(),
    onSuccess: (saved) => {
      toast(saved.isPublished ? '영상을 공개했어요.' : '영상을 비공개로 돌렸어요.');
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const reorder = useMutation({
    // Serial (one request at a time, in click order) so quick consecutive moves cannot land out of
    // order; the cache already holds the optimistic order, so success needs no refetch.
    scope: { id: 'admin-videos-order' },
    mutationFn: (ids: string[]) => videos.reorder(ids),
    onError: (e) => {
      toast({ message: errorMessage(e), tone: 'error' });
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => videos.remove(id),
    onSuccess: () => {
      setDeleting(null);
      void invalidate();
      toast('영상을 삭제했어요.');
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const move = (video: Video, delta: -1 | 1) => {
    const next = moveById(all, video.id, delta).map((v, i) => ({ ...v, sortOrder: i + 1 }));
    queryClient.setQueryData<Page<Video>>(key, (prev) => (prev ? { ...prev, items: next } : prev));
    reorder.mutate(next.map((v) => v.id));
  };
  const live = all.filter((v) => v.isPublished).length;

  return (
    <>
      <div className={s.bar}>
        <div className={s.filters}>
          <ListSearchField
            className={s.search}
            label="영상 제목·설명 검색"
            placeholder="제목, 설명 검색"
            value={search}
            onSearch={setSearch}
          />
        </div>
        <div className={s.barEnd}>
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setEditing('new')}>
            영상 추가
          </Button>
        </div>
      </div>

      <Panel
        title="동네TV"
        count={list.data ? all.length : undefined}
        description={
          needle
            ? '검색 중에는 순서를 바꿀 수 없어요'
            : '위에서부터 메인 화면과 동네TV 목록에 보여요'
        }
        flush
        footer={
          all.length > 0 ? (
            <span>
              공개 <b className={s.num}>{live}</b>개 · 비공개{' '}
              <b className={s.num}>{all.length - live}</b>개 · 메인 화면에는 공개 영상 중 위 4개가
              보여요
            </span>
          ) : undefined
        }
      >
        {list.isPending ? (
          <ul className={styles.list} aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className={styles.row}>
                <Skeleton width={144} height={81} radius={8} />
                <div className={styles.body}>
                  <Skeleton height={16} width="64%" />
                  <Skeleton height={13} width="40%" />
                </div>
              </li>
            ))}
          </ul>
        ) : list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          all.length === 0 ? (
            <EmptyState
              compact
              icon="play"
              title="아직 등록한 영상이 없어요"
              description="YouTube 주소만 붙여 넣으면 동네 소식 영상을 소개할 수 있어요."
              action={
                <Button size="sm" onClick={() => setEditing('new')}>
                  첫 영상 추가
                </Button>
              }
            />
          ) : (
            <EmptyState
              compact
              title="조건에 맞는 영상이 없어요"
              description="검색어를 바꿔 보세요."
            />
          )
        ) : (
          <ul className={styles.list}>
            {rows.map((video, index) => {
              const region = regionName(video.regionCode);
              return (
                <li key={video.id} className={styles.row}>
                  <OrderButtons
                    name={video.title}
                    index={index}
                    count={rows.length}
                    disabled={!!needle}
                    onMove={(delta) => move(video, delta)}
                  />
                  <span className={styles.rank} aria-label={`${index + 1}번째`}>
                    {index + 1}
                  </span>
                  <VideoThumb url={video.thumbnailUrl} off={!video.isPublished} />
                  <div className={styles.body}>
                    <span className={styles.title}>{video.title}</span>
                    {video.description && <span className={styles.desc}>{video.description}</span>}
                    <span className={styles.meta}>
                      {video.complexName && <Tag>{video.complexName}</Tag>}
                      {region && <Tag>{region}</Tag>}
                      <span>
                        {video.publishedAt
                          ? `${formatDateShort(video.publishedAt)} 공개`
                          : '공개 전'}
                      </span>
                    </span>
                  </div>
                  <div className={styles.controls}>
                    <Switch
                      checked={video.isPublished}
                      disabled={toggle.isPending && toggle.variables.id === video.id}
                      onChange={() => toggle.mutate(video)}
                      aria-label={`${video.title} 공개`}
                    >
                      <span className={styles.stateLabel}>
                        {video.isPublished ? '공개' : '비공개'}
                      </span>
                    </Switch>
                    <span className={s.rowActions}>
                      <a
                        className={s.iconLink}
                        href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeVideoId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${video.title} YouTube에서 보기 (새 창)`}
                      >
                        <Icon name="external-link" size={18} />
                      </a>
                      <IconButton
                        label={`${video.title} 수정`}
                        size={36}
                        variant="plain"
                        onClick={() => setEditing(video)}
                      >
                        <Icon name="edit" size={18} />
                      </IconButton>
                      <IconButton
                        label={`${video.title} 삭제`}
                        size={36}
                        variant="plain"
                        onClick={() => setDeleting(video)}
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
      <Callout size="sm" tone="muted">
        영상은 YouTube에 올린 뒤 주소를 등록해요. 썸네일은 YouTube에서 자동으로 가져오고, 사용자
        화면에서는 재생 버튼을 누를 때만 YouTube 플레이어를 불러와요.
      </Callout>

      <VideoDrawer
        editing={editing}
        regions={regions.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void invalidate();
        }}
        onDelete={(video) => {
          setEditing(null);
          setDeleting(video);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="영상을 삭제할까요?"
        description={
          deleting
            ? `"${deleting.title}" 영상이 동네TV에서 사라져요. YouTube 원본 영상은 그대로 남아요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
