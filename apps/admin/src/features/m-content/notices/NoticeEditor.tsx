'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BackLink,
  Button,
  Callout,
  ConfirmDialog,
  Icon,
  Input,
  Panel,
  Skeleton,
  StatusPill,
  Switch,
  useToast,
} from '@house/ui';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPageHeader } from '@/components/shell';
import { ADMIN_ROUTES } from '@/config/nav';
import { ApiError, qk } from '@/lib/api';
import { formatCount, formatDate, formatDateTime } from '@/lib/format';
import { notices } from '../api';
import { noticeFormSchema, type NoticeForm } from '../api/inputs';
import { LoadError } from '../components/LoadError';
import { MarkupEditor } from '../components/MarkupEditor';
import { RichPreview } from '../components/RichPreview';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './NoticeEditor.module.css';

const EMPTY: NoticeForm = { title: '', content: '', isPinned: false, isPublished: false };
const CRUMB = ['운영', { label: '콘텐츠 · 공지사항', href: ADMIN_ROUTES.notices }] as const;

/** Create (`id` undefined) or edit a notice: form on the left, publish settings + live preview on the right. */
export function NoticeEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detail = useQuery({
    queryKey: qk('admin-notices', 'detail', id),
    queryFn: ({ signal }) => notices.get(id ?? '', { signal }),
    enabled: !!id,
  });
  const form = useForm<NoticeForm>({
    resolver: zodResolver(noticeFormSchema),
    defaultValues: EMPTY,
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, reset, watch, setError, formState } = form;
  const notice = detail.data;
  useEffect(() => {
    if (notice)
      reset({
        title: notice.title,
        content: notice.content,
        isPinned: notice.isPinned,
        isPublished: notice.isPublished,
      });
  }, [notice, reset]);
  useUnsavedGuard(formState.isDirty);

  const save = useMutation({
    mutationFn: (values: NoticeForm) => (id ? notices.update(id, values) : notices.create(values)),
    onSuccess: (saved, values) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-notices'] });
      reset(values);
      toast(
        id
          ? '공지를 저장했어요.'
          : values.isPublished
            ? '공지를 게시했어요.'
            : '공지를 비공개로 저장했어요.',
      );
      if (!id) router.replace(`${ADMIN_ROUTES.notices}/${saved.id}`);
    },
    onError: (e) => {
      const message = applyServerErrors(e, setError, ['title', 'content']);
      if (message) toast({ message, tone: 'error' });
    },
  });
  const remove = useMutation({
    mutationFn: () => notices.remove(id ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-notices'] });
      toast('공지를 삭제했어요.');
      router.replace(ADMIN_ROUTES.notices);
    },
    onError: (e) =>
      toast({ message: e instanceof Error ? e.message : '삭제하지 못했어요.', tone: 'error' }),
  });

  const values = watch();
  const errors = formState.errors;

  if (id && detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.isNotFound;
    return (
      <>
        <AdminPageHeader title="공지 수정" crumb={CRUMB} />
        <BackLink linkAs={Link} href={ADMIN_ROUTES.notices}>
          공지사항 목록
        </BackLink>
        <Panel>
          <LoadError
            error={detail.error}
            title={notFound ? '공지를 찾을 수 없어요' : undefined}
            onRetry={notFound ? undefined : () => void detail.refetch()}
          />
        </Panel>
      </>
    );
  }
  const loading = !!id && detail.isPending;

  return (
    <form
      className={`${s.stackLg} ${s.fill}`}
      noValidate
      onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
      aria-busy={loading || undefined}
    >
      <AdminPageHeader title={id ? '공지 수정' : '새 공지 작성'} crumb={CRUMB} />
      <div className={s.bar}>
        <BackLink linkAs={Link} href={ADMIN_ROUTES.notices}>
          공지사항 목록
        </BackLink>
        {notice && (
          <div className={s.barEnd}>
            <StatusPill tone={notice.isPublished ? 'live' : 'ended'}>
              {notice.isPublished ? '공개 중' : '비공개'}
            </StatusPill>
          </div>
        )}
      </div>

      <div className={`${s.split} ${s.splitWide}`}>
        <Panel title="내용">
          {loading ? (
            <div className={s.stack}>
              <Skeleton height={48} radius={12} />
              <Skeleton height={360} radius={12} />
            </div>
          ) : (
            <div className={s.stack}>
              <Input
                label="제목"
                required
                maxLength={200}
                placeholder="예: 12월 정기 점검 안내"
                error={errors.title?.message}
                {...register('title')}
              />
              <Controller
                control={control}
                name="content"
                render={({ field }) => (
                  <MarkupEditor
                    label="내용"
                    required
                    rows={16}
                    maxLength={50_000}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.content?.message}
                    placeholder={'공지 내용을 입력해 주세요.\n\n## 소제목\n- 목록 항목'}
                  />
                )}
              />
            </div>
          )}
        </Panel>

        <div className={s.aside}>
          <Panel title="게시 설정">
            <div>
              <div className={s.switchRow}>
                <div className={s.switchText}>
                  <span className={s.switchLabel}>사용자 화면에 공개</span>
                  <span className={s.switchHelp}>끄면 저장만 되고 목록에 보이지 않아요.</span>
                </div>
                <Switch aria-label="사용자 화면에 공개" {...register('isPublished')} />
              </div>
              <div className={s.switchRow}>
                <div className={s.switchText}>
                  <span className={s.switchLabel}>목록 맨 위에 고정</span>
                  <span className={s.switchHelp}>중요한 공지를 항상 먼저 보여 줘요.</span>
                </div>
                <Switch aria-label="목록 맨 위에 고정" {...register('isPinned')} />
              </div>
            </div>
            {values.isPinned && !values.isPublished && (
              <Callout size="sm" tone="warn" className={styles.gapTop}>
                비공개 공지는 고정해도 보이지 않아요. 공개로 바꿔 주세요.
              </Callout>
            )}
            {notice && (
              <dl className={`${s.facts} ${styles.gapTop}`}>
                <dt>작성자</dt>
                <dd>{notice.createdByAdminName ?? '알 수 없음'}</dd>
                <dt>게시일</dt>
                <dd>{notice.publishedAt ? formatDateTime(notice.publishedAt) : '아직 게시 전'}</dd>
                <dt>마지막 수정</dt>
                <dd>{formatDateTime(notice.updatedAt)}</dd>
                <dt>조회수</dt>
                <dd>{formatCount(notice.viewCount)}회</dd>
              </dl>
            )}
          </Panel>

          <Panel title="미리보기" description="사용자 화면과 같은 모습이에요">
            <article className={styles.preview}>
              <p className={styles.previewMeta}>
                {values.isPinned && <span className={styles.previewPin}>고정</span>}
                공지사항 · {formatDate(notice?.publishedAt ?? new Date())}
              </p>
              <h3 className={styles.previewTitle}>{values.title || '제목이 여기에 보여요'}</h3>
              <RichPreview source={values.content} compact />
            </article>
          </Panel>
        </div>
      </div>

      <SaveBar
        dirty={formState.isDirty}
        info={notice ? `${formatDateTime(notice.updatedAt)} 저장됨` : '아직 저장하지 않았어요'}
      >
        {id && (
          <Button
            type="button"
            variant="ghost"
            className={s.dangerText}
            iconLeft={<Icon name="trash" size={18} />}
            onClick={() => setConfirmDelete(true)}
          >
            삭제
          </Button>
        )}
        <Button type="submit" loading={save.isPending} disabled={loading}>
          {id ? '저장' : values.isPublished ? '게시' : '비공개로 저장'}
        </Button>
      </SaveBar>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        title="공지를 삭제할까요?"
        description="사용자 화면에서도 사라지고, 삭제한 공지는 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </form>
  );
}
