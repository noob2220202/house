'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseYoutubeVideoId } from '@house/shared';
import {
  Button,
  Chip,
  Combobox,
  Drawer,
  Icon,
  Input,
  Select,
  Switch,
  Textarea,
  useDebouncedValue,
  useToast,
} from '@house/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { qk } from '@/lib/api';
import { complexes, videos } from '../api';
import { videoCreateBody, videoFormSchema, videoPatchBody, type VideoForm } from '../api/inputs';
import { regionLabel, type Region } from '../api/regions';
import type { Video } from '../api/schemas';
import drawer from '../components/drawer.module.css';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { VideoThumb } from './VideoThumb';
import styles from './VideosView.module.css';

const EMPTY: VideoForm = {
  title: '',
  youtubeUrl: '',
  description: '',
  regionCode: '',
  complexId: '',
  isPublished: true,
};

export function VideoDrawer({
  editing,
  regions,
  onClose,
  onSaved,
  onDelete,
}: {
  editing: Video | 'new' | null;
  regions: readonly Region[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (video: Video) => void;
}) {
  const { toast } = useToast();
  const video = editing && editing !== 'new' ? editing : null;
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<VideoForm>({
      resolver: zodResolver(videoFormSchema),
      defaultValues: EMPTY,
      mode: 'onBlur',
    });
  /** Name of the linked complex (the form only stores its id). */
  const [complexName, setComplexName] = useState<string | null>(null);
  const [complexSearch, setComplexSearch] = useState('');
  useEffect(() => {
    if (!editing) return;
    reset(
      editing === 'new'
        ? EMPTY
        : {
            title: editing.title,
            youtubeUrl: editing.youtubeUrl,
            description: editing.description ?? '',
            regionCode: editing.regionCode ?? '',
            complexId: editing.complexId ?? '',
            isPublished: editing.isPublished,
          },
    );
    setComplexName(editing === 'new' ? null : editing.complexName);
    setComplexSearch('');
  }, [editing, reset]);

  const q = useDebouncedValue(complexSearch.trim(), 250);
  const options = useQuery({
    queryKey: qk('admin-complexes', 'picker', q),
    queryFn: ({ signal }) => complexes.list({ q, pageSize: 8, sort: 'views' }, { signal }),
    enabled: editing !== null && q.length > 0,
  });

  const save = useMutation({
    mutationFn: (values: VideoForm) =>
      video
        ? videos.update(video.id, videoPatchBody(values, video))
        : videos.create(videoCreateBody(values)),
    onSuccess: () => {
      toast(video ? '영상을 저장했어요.' : '영상을 추가했어요.');
      onSaved();
    },
    onError: (e) => {
      const message = applyServerErrors(e, setError, ['title', 'youtubeUrl', 'description']);
      if (message) toast({ message, tone: 'error' });
    },
  });

  const url = watch('youtubeUrl');
  const complexId = watch('complexId');
  const videoId = parseYoutubeVideoId(url.trim());
  // A saved video keeps its stored thumbnail until the address changes.
  const thumb =
    video && url.trim() === video.youtubeUrl
      ? video.thumbnailUrl
      : videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : null;
  const errors = formState.errors;

  return (
    <Drawer
      open={editing !== null}
      onClose={onClose}
      title={video ? '영상 수정' : '영상 추가'}
      width={520}
      footer={
        <div className={drawer.footer}>
          {video && (
            <Button
              type="button"
              variant="ghost"
              className={s.dangerText}
              iconLeft={<Icon name="trash" size={18} />}
              onClick={() => onDelete(video)}
            >
              삭제
            </Button>
          )}
          <span className={drawer.spacer} />
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="video-form" loading={save.isPending}>
            저장
          </Button>
        </div>
      }
    >
      <form
        id="video-form"
        className={s.stack}
        noValidate
        onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
      >
        <Input
          label="YouTube 주소"
          required
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          prefix={<Icon name="link" size={18} />}
          error={errors.youtubeUrl?.message}
          help="watch, youtu.be, shorts, live 주소를 모두 쓸 수 있어요."
          {...register('youtubeUrl')}
        />
        {videoId && (
          <div className={styles.urlCheck}>
            <VideoThumb url={thumb} />
            <div className={styles.urlInfo}>
              <span className={styles.urlOk}>
                <Icon name="check-circle" size={16} />
                영상을 확인했어요
              </span>
              <span>
                영상 ID <span className={styles.urlId}>{videoId}</span>
              </span>
            </div>
          </div>
        )}
        <Input
          label="제목"
          required
          maxLength={200}
          placeholder="예: 신대지구 34평, 지금 사도 될까?"
          error={errors.title?.message}
          {...register('title')}
        />
        <Textarea
          label="설명"
          rows={3}
          maxLength={2000}
          placeholder="영상 내용을 한두 문장으로 소개해 주세요."
          error={errors.description?.message}
          {...register('description')}
        />
        <Select
          label="관련 지역"
          placeholder="선택 안 함"
          options={[
            { value: '', label: '선택 안 함' },
            ...regions.map((r) => ({ value: r.code, label: regionLabel(r) })),
          ]}
          help="지역을 고르면 그 지역 지도 화면에서도 영상을 소개해요."
          {...register('regionCode')}
        />
        <div>
          <Combobox
            label="관련 단지"
            placeholder="단지명 검색"
            inputValue={complexSearch}
            onInputChange={setComplexSearch}
            options={(options.data?.items ?? []).map((c) => ({
              value: c.id,
              label: c.name,
              description: c.emdName ?? undefined,
            }))}
            loading={options.isFetching}
            emptyText={q ? '검색 결과가 없어요' : '단지명을 입력해 주세요'}
            onSelect={(option) => {
              setValue('complexId', option.value, { shouldDirty: true });
              setComplexName(option.label);
              setComplexSearch('');
            }}
            help="단지를 연결하면 단지 상세 화면에 영상이 함께 보여요."
          />
          {complexId && (
            <div className={styles.linked}>
              <Chip
                selected
                onRemove={() => {
                  setValue('complexId', '', { shouldDirty: true });
                  setComplexName(null);
                }}
                removeLabel="단지 연결 해제"
              >
                {complexName ?? '연결된 단지'}
              </Chip>
            </div>
          )}
        </div>
        <div className={s.switchRow}>
          <div className={s.switchText}>
            <span className={s.switchLabel}>사용자 화면에 공개</span>
            <span className={s.switchHelp}>끄면 동네TV 목록에 보이지 않아요.</span>
          </div>
          <Switch aria-label="사용자 화면에 공개" {...register('isPublished')} />
        </div>
      </form>
    </Drawer>
  );
}
