'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { TERMS_TYPE_LABEL, TermsType } from '@house/shared';
import {
  BackLink,
  Badge,
  Button,
  Callout,
  Checkbox,
  ConfirmDialog,
  Icon,
  Input,
  Modal,
  Panel,
  Select,
  Skeleton,
  StatusPill,
  Switch,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPageHeader } from '@/components/shell';
import { ADMIN_ROUTES } from '@/config/nav';
import { ApiError, errorMessage, qk } from '@/lib/api';
import { formatCount, formatDate, formatDateTime } from '@/lib/format';
import { terms } from '../api';
import { termsFormSchema, type TermsForm } from '../api/inputs';
import type { TermsDocument } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { MarkupEditor } from '../components/MarkupEditor';
import { RichPreview } from '../components/RichPreview';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import {
  TERMS_STATE_LABEL,
  TERMS_STATE_TONE,
  daysUntil,
  isoToKstDate,
  kstDateAfter,
  kstDateToIso,
  nextVersion,
  termsState,
} from '../lib/terms';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './settings.module.css';

const TYPES = Object.values(TermsType);
const CRUMB = ['설정', { label: '약관·정책', href: ADMIN_ROUTES.terms }] as const;
const REQUIRED_BY_DEFAULT: readonly TermsType[] = [TermsType.SERVICE, TermsType.PRIVACY];
const isTermsType = (v: string | null): v is TermsType => TYPES.includes(v as TermsType);

function effectiveLabel(iso: string): string {
  const left = daysUntil(iso);
  return `${formatDate(iso)}${left > 0 ? ` (D-${left})` : left === 0 ? ' (오늘)' : ''}`;
}

/** Read-only view of a published version. */
function PublishedTerms({ doc }: { doc: TermsDocument }) {
  const state = termsState(doc);
  return (
    <>
      <AdminPageHeader title={`${doc.title} ${doc.version}`} crumb={CRUMB} />
      <div className={s.bar}>
        <BackLink linkAs={Link} href={ADMIN_ROUTES.terms}>
          약관 목록
        </BackLink>
        <div className={s.barEnd}>
          <StatusPill tone={TERMS_STATE_TONE[state]}>{TERMS_STATE_LABEL[state]}</StatusPill>
        </div>
      </div>
      <div className={s.split}>
        <Panel title="본문" description="사용자 화면과 같은 모습이에요">
          <article className={styles.readDoc}>
            <h3 className={styles.docTitle}>{doc.title}</h3>
            <p className={styles.docMeta}>
              버전 {doc.version} · {formatDate(doc.effectiveAt)} 적용
            </p>
            <RichPreview source={doc.content} />
          </article>
        </Panel>
        <div className={s.aside}>
          <Panel title="버전 정보">
            <dl className={s.facts}>
              <dt>종류</dt>
              <dd>{TERMS_TYPE_LABEL[doc.type]}</dd>
              <dt>버전</dt>
              <dd>{doc.version}</dd>
              <dt>동의 구분</dt>
              <dd>{doc.isRequired ? '필수 동의' : '선택 동의'}</dd>
              <dt>적용일</dt>
              <dd>{effectiveLabel(doc.effectiveAt)}</dd>
              <dt>게시일</dt>
              <dd>{doc.publishedAt ? formatDateTime(doc.publishedAt) : '–'}</dd>
              <dt>동의 회원</dt>
              <dd>{doc.consentCount === null ? '–' : `${formatCount(doc.consentCount)}명`}</dd>
            </dl>
            <Callout size="sm" tone="muted" icon="lock" className={styles.gapTop}>
              게시된 약관은 수정하거나 삭제할 수 없어요. 내용을 바꾸려면 새 버전을 작성해 주세요.
            </Callout>
            <Button
              block
              variant="secondary"
              className={styles.gapTop}
              href={`${ADMIN_ROUTES.terms}/new?type=${doc.type}&from=${doc.id}`}
              linkAs={Link}
              iconLeft={<Icon name="copy" size={18} />}
            >
              이 내용으로 새 버전 작성
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}

function PublishModal({
  doc,
  open,
  onClose,
  onPublished,
}: {
  doc: TermsDocument;
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { toast } = useToast();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);
  const publish = useMutation({
    mutationFn: () => terms.publish(doc.id),
    onSuccess: (result) => {
      const n = result.reconsentUserCount;
      toast(
        doc.isRequired && n
          ? `게시했어요. 회원 ${formatCount(n)}명이 적용일 이후 다시 동의하게 돼요.`
          : '약관을 게시했어요.',
      );
      onPublished();
    },
    onError: (e) => {
      toast({ message: errorMessage(e), tone: 'error' });
      onClose();
    },
  });
  const left = daysUntil(doc.effectiveAt);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`${doc.title} ${doc.version} 버전을 게시할까요?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={!checked} loading={publish.isPending} onClick={() => publish.mutate()}>
            게시
          </Button>
        </>
      }
    >
      <ul className={styles.publishList}>
        <li>
          {left > 0 ? (
            <>
              <strong>{formatDate(doc.effectiveAt)}</strong> ({left}일 뒤)부터 사용자 화면에 이
              버전이 보여요. 그 전까지는 지금 버전이 유지돼요.
            </>
          ) : (
            <>
              적용일이 <strong>{formatDate(doc.effectiveAt)}</strong>이라 게시하는 즉시 이 버전이
              적용돼요.
            </>
          )}
        </li>
        <li>
          {doc.isRequired ? (
            <>
              <strong>필수 약관</strong>이라 회원은 적용일 이후 처음 방문할 때 다시 동의해야
              서비스를 계속 이용할 수 있어요.
            </>
          ) : (
            <>
              <strong>선택 약관</strong>이라 다시 동의하라는 화면은 뜨지 않아요. 새로 동의하는
              회원부터 이 버전이 기록돼요.
            </>
          )}
        </li>
        <li>
          게시한 뒤에는 <strong>내용을 고치거나 삭제할 수 없어요.</strong>
        </li>
      </ul>
      <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)}>
        본문과 적용일을 확인했어요
      </Checkbox>
    </Modal>
  );
}

/**
 * 약관 작성 · 수정. `id` undefined = a new draft (optionally copied from `?from=<id>`), a draft is
 * editable, a published version is shown read-only.
 */
export function TermsEditor({ id }: { id?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fromId = id ? null : searchParams.get('from');
  const paramType = searchParams.get('type');
  const detail = useQuery({
    queryKey: qk('admin-terms', 'detail', id),
    queryFn: ({ signal }) => terms.get(id ?? '', { signal }),
    enabled: !!id,
  });
  const source = useQuery({
    queryKey: qk('admin-terms', 'detail', fromId),
    queryFn: ({ signal }) => terms.get(fromId ?? '', { signal }),
    enabled: !!fromId,
  });
  const list = useQuery({
    queryKey: qk('admin-terms', 'list', {}),
    queryFn: ({ signal }) => terms.list({}, { signal }),
    enabled: !id,
  });
  const versionsOf = useMemo(() => {
    const items = list.data?.items ?? [];
    return (type: TermsType) => items.filter((d) => d.type === type).map((d) => d.version);
  }, [list.data]);

  const doc = detail.data;
  const copied = source.data;
  const initial = useMemo<TermsForm>(() => {
    if (doc)
      return {
        type: doc.type,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        isRequired: doc.isRequired,
        effectiveDate: isoToKstDate(doc.effectiveAt),
      };
    const type = copied?.type ?? (isTermsType(paramType) ? paramType : TermsType.SERVICE);
    return {
      type,
      version: nextVersion(versionsOf(type)),
      title: copied?.title ?? TERMS_TYPE_LABEL[type],
      content: copied?.content ?? '',
      isRequired: copied?.isRequired ?? REQUIRED_BY_DEFAULT.includes(type),
      effectiveDate: kstDateAfter(7),
    };
  }, [doc, copied, paramType, versionsOf]);

  const form = useForm<TermsForm>({
    resolver: zodResolver(termsFormSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, reset, watch, setValue, setError, getFieldState } = form;
  const { formState } = form;
  // Late data (version list, copied source) must not wipe what the operator already typed.
  const dirtyRef = useRef(false);
  dirtyRef.current = formState.isDirty;
  useEffect(() => {
    if (!dirtyRef.current) reset(initial);
  }, [initial, reset]);
  useUnsavedGuard(formState.isDirty);

  const save = useMutation({
    mutationFn: (v: TermsForm) => {
      const body = {
        version: v.version,
        title: v.title,
        content: v.content,
        isRequired: v.isRequired,
        effectiveAt: kstDateToIso(v.effectiveDate),
      };
      return id ? terms.update(id, body) : terms.create({ type: v.type, ...body });
    },
    onSuccess: (saved, v) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-terms', 'list'] });
      queryClient.setQueryData(qk('admin-terms', 'detail', saved.id), saved);
      reset(v);
      toast(
        id
          ? '약관을 저장했어요.'
          : '작성 중인 버전으로 저장했어요. 내용을 확인한 뒤 게시해 주세요.',
      );
      if (!id) router.replace(`${ADMIN_ROUTES.terms}/${saved.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'TERMS_VERSION_EXISTS') {
        setError('version', {
          message: '같은 버전이 이미 있어요. 다른 버전 번호를 입력해 주세요.',
        });
        return;
      }
      const message = applyServerErrors(e, setError, [
        'type',
        'version',
        'title',
        'content',
        'isRequired',
      ]);
      if (message) toast({ message, tone: 'error' });
    },
  });
  const remove = useMutation({
    mutationFn: () => terms.remove(id ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-terms'] });
      toast('작성 중인 버전을 삭제했어요.');
      router.replace(ADMIN_ROUTES.terms);
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  if (id && detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.isNotFound;
    return (
      <>
        <AdminPageHeader title="약관" crumb={CRUMB} />
        <BackLink linkAs={Link} href={ADMIN_ROUTES.terms}>
          약관 목록
        </BackLink>
        <Panel>
          <LoadError
            error={detail.error}
            title={notFound ? '약관을 찾을 수 없어요' : undefined}
            onRetry={notFound ? undefined : () => void detail.refetch()}
          />
        </Panel>
      </>
    );
  }
  if (doc?.publishedAt) return <PublishedTerms doc={doc} />;

  const loading = (!!id && detail.isPending) || (!!fromId && source.isPending);
  const values = watch();
  const errors = formState.errors;
  const typeField = register('type');
  const left = /^\d{4}-\d{2}-\d{2}$/.test(values.effectiveDate)
    ? daysUntil(kstDateToIso(values.effectiveDate))
    : null;

  return (
    <form
      className={`${s.stackLg} ${s.fill}`}
      noValidate
      onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
      aria-busy={loading || undefined}
    >
      <AdminPageHeader title={id ? '약관 수정' : '새 약관 작성'} crumb={CRUMB} />
      <div className={s.bar}>
        <BackLink linkAs={Link} href={ADMIN_ROUTES.terms}>
          약관 목록
        </BackLink>
        <div className={s.barEnd}>
          <StatusPill tone="review">작성 중</StatusPill>
        </div>
      </div>
      {copied && !id && (
        <Callout size="sm">
          <strong>
            {copied.title} {copied.version}
          </strong>{' '}
          버전의 내용을 불러왔어요. 바뀌는 조항을 고친 뒤 저장해 주세요.
        </Callout>
      )}

      <div className={`${s.split} ${s.splitWide}`}>
        <Panel title="약관 내용">
          {loading ? (
            <div className={s.stack}>
              <Skeleton height={72} radius={12} />
              <Skeleton height={420} radius={12} />
            </div>
          ) : (
            <div className={s.stack}>
              <div className={`${s.formGrid} ${s.formGrid3}`}>
                <Select
                  label="종류"
                  required
                  disabled={!!id}
                  options={TYPES.map((t) => ({ value: t, label: TERMS_TYPE_LABEL[t] }))}
                  error={errors.type?.message}
                  help={id ? '종류는 바꿀 수 없어요.' : undefined}
                  {...typeField}
                  onChange={(e) => {
                    void typeField.onChange(e);
                    const next = e.target.value;
                    if (!isTermsType(next)) return;
                    // Follow the type with the suggested version / title until the operator edits them.
                    if (!getFieldState('version').isDirty)
                      setValue('version', nextVersion(versionsOf(next)));
                    if (!getFieldState('title').isDirty) setValue('title', TERMS_TYPE_LABEL[next]);
                    if (!getFieldState('isRequired').isDirty)
                      setValue('isRequired', REQUIRED_BY_DEFAULT.includes(next));
                  }}
                />
                <Input
                  label="버전"
                  required
                  maxLength={20}
                  inputMode="decimal"
                  placeholder="1.1"
                  error={errors.version?.message}
                  {...register('version')}
                />
                <Input
                  label="적용일"
                  required
                  type="date"
                  min={kstDateAfter(0)}
                  error={errors.effectiveDate?.message}
                  help={left !== null && left > 0 ? `${left}일 뒤부터 적용돼요.` : undefined}
                  {...register('effectiveDate')}
                />
              </div>
              <Input
                label="제목"
                required
                maxLength={200}
                error={errors.title?.message}
                {...register('title')}
              />
              <Controller
                control={control}
                name="content"
                render={({ field }) => (
                  <MarkupEditor
                    label="본문"
                    required
                    rows={22}
                    maxLength={200_000}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.content?.message}
                    help="'제1조 (목적)'처럼 쓰면 조항 제목으로 보여요."
                    placeholder={'제1조 (목적)\n이 약관은 …'}
                  />
                )}
              />
            </div>
          )}
        </Panel>

        <div className={s.aside}>
          <Panel title="동의 · 게시">
            <div className={s.switchRow}>
              <div className={s.switchText}>
                <span className={s.switchLabel}>필수 동의 약관</span>
                <span className={s.switchHelp}>
                  동의하지 않으면 가입할 수 없고, 새 버전이 적용되면 기존 회원도 다시 동의해요.
                </span>
              </div>
              <Switch aria-label="필수 동의 약관" {...register('isRequired')} />
            </div>
            {left !== null && left < 7 && (
              <Callout size="sm" tone="warn" className={styles.gapTop}>
                적용일이 {left <= 0 ? '오늘이거나 이미 지났어요' : `${left}일 뒤예요`}. 개정 약관은
                보통 적용 7일 전(회원에게 불리한 변경은 30일 전)까지 공지해요.
              </Callout>
            )}
            {doc && (
              <dl className={`${s.facts} ${styles.gapTop}`}>
                <dt>마지막 저장</dt>
                <dd>{formatDateTime(doc.updatedAt)}</dd>
                <dt>적용 예정일</dt>
                <dd>{effectiveLabel(doc.effectiveAt)}</dd>
              </dl>
            )}
            <p className={styles.metaNote}>
              저장하면 &lsquo;작성 중&rsquo; 상태로 남아요. 게시해야 사용자 화면에 보여요.
            </p>
          </Panel>

          <Panel title="미리보기" description="사용자 화면과 같은 모습이에요">
            <article className={styles.readDoc} style={{ maxHeight: 480 }}>
              <h3 className={styles.docTitle}>{values.title || '제목'}</h3>
              <p className={styles.docMeta}>
                버전 {values.version || '–'}
                {left !== null && ` · ${formatDate(kstDateToIso(values.effectiveDate))} 적용`}{' '}
                <Badge tone={values.isRequired ? 'brand' : 'neutral'}>
                  {values.isRequired ? '필수' : '선택'}
                </Badge>
              </p>
              <RichPreview source={values.content} compact />
            </article>
          </Panel>
        </div>
      </div>

      <SaveBar
        dirty={formState.isDirty}
        info={doc ? '게시하면 수정할 수 없어요' : '저장한 뒤에 게시할 수 있어요'}
      >
        {doc && (
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
        <Button
          type="submit"
          variant={doc ? 'secondary' : 'primary'}
          loading={save.isPending}
          disabled={loading || (!!doc && !formState.isDirty)}
        >
          {doc ? '저장' : '작성 중으로 저장'}
        </Button>
        {doc && (
          <Button
            type="button"
            disabled={formState.isDirty || save.isPending}
            title={formState.isDirty ? '먼저 변경 사항을 저장해 주세요' : undefined}
            onClick={() => setPublishing(true)}
          >
            게시
          </Button>
        )}
      </SaveBar>

      {doc && (
        <PublishModal
          doc={doc}
          open={publishing}
          onClose={() => setPublishing(false)}
          onPublished={() => {
            setPublishing(false);
            void queryClient.invalidateQueries({ queryKey: ['admin-terms'] });
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        title="작성 중인 버전을 삭제할까요?"
        description="내용이 사라지고 되돌릴 수 없어요. 게시된 버전에는 영향이 없어요."
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </form>
  );
}
