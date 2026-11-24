'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { MediaPurpose, type PopupPage } from '@house/shared';
import {
  Button,
  Chip,
  ConfirmDialog,
  cx,
  ErrorState,
  Icon,
  Input,
  Select,
  Skeleton,
  StatusPill,
  useToast,
} from '@house/ui';
import { useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { usePopup, useSavePopup } from '../api/hooks';
import type { AdminPopup } from '../api/schemas';
import {
  LINK_URL_MESSAGE,
  requestedPosition,
  resolvePosition,
  TITLE_MAX,
} from '../lib/banner-form';
import { endOfKstDay, isDay, startOfKstDay } from '../lib/dates';
import { POPUP_IMAGE_SPEC } from '../lib/image-rules';
import {
  dismissLabel,
  DISMISS_PRESETS,
  duplicatePopupToForm,
  emptyPopupForm,
  POPUP_PAGE_LABEL,
  POPUP_PAGES,
  popupFormSchema,
  popupToForm,
  togglePopupPage,
  toPopupInput,
  type PopupFormValues,
} from '../lib/popup-form';
import { displayCode, scheduleStatus, STATUS_PILL_LABEL, STATUS_TONE } from '../lib/status';
import type { EditorMode } from './BannerEditor';
import styles from './editor.module.css';
import { EditorBody, EditorFooter, EditorPanel } from './EditorPanel';
import { FormField } from './FormField';
import { ImageUploadField } from './ImageUploadField';
import { LinkField } from './LinkField';
import { PopupPreview } from './PopupPreview';
import { DateRangeField, StatusField } from './ScheduleFields';

export interface PopupEditorProps {
  mode: EditorMode;
  popupId: string | null;
  /** Number of popups (order select). */
  count: number;
  onClose: () => void;
  onSaved: (popup: AdminPopup, mode: EditorMode) => void;
  onDelete: (popup: AdminPopup) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const TITLES: Record<EditorMode, string> = {
  new: '새 팝업 등록',
  edit: '팝업 수정',
  copy: '팝업 복제',
};

const SERVER_FIELD: Record<string, keyof PopupFormValues> = {
  title: 'title',
  mediaId: 'image',
  linkUrl: 'linkUrl',
  targetPages: 'targetPages',
  startAt: 'startDate',
  endAt: 'endDate',
  dismissDays: 'dismissDays',
};

/** Edit drawer for one popup (create / edit / duplicate) with the live preview on top. */
export function PopupEditor(props: PopupEditorProps) {
  const { mode, popupId, onClose } = props;
  const source = usePopup(mode === 'new' ? null : popupId);
  // New popups and copies start at LAST_POSITION, so the defaults never depend on a list that may
  // still be loading (a deep link to ?new=1 used to default to the top).
  const initial = useMemo<PopupFormValues | null>(() => {
    if (mode === 'new') return emptyPopupForm();
    if (!source.data) return null;
    return mode === 'edit' ? popupToForm(source.data) : duplicatePopupToForm(source.data);
  }, [mode, source.data]);

  if (initial)
    return (
      <PopupForm
        key={`${mode}:${popupId ?? 'new'}`}
        {...props}
        initial={initial}
        original={mode === 'edit' ? (source.data ?? null) : null}
      />
    );
  const missing = source.error instanceof ApiError && source.error.isNotFound;
  return (
    <EditorPanel title={TITLES[mode]} onClose={onClose}>
      <EditorBody>
        {source.isError ? (
          <ErrorState
            compact
            title={missing ? '팝업을 찾을 수 없어요' : '팝업을 불러오지 못했어요'}
            description={missing ? '이미 삭제되었을 수 있어요.' : undefined}
            onRetry={() => void source.refetch()}
          />
        ) : (
          <div className={styles.skForm} role="status" aria-label="팝업 불러오는 중">
            <Skeleton height={260} radius={14} />
            <Skeleton height={42} radius={10} />
            <Skeleton height={112} radius={12} />
            <Skeleton height={42} radius={10} />
          </div>
        )}
      </EditorBody>
    </EditorPanel>
  );
}

function PopupForm({
  mode,
  popupId,
  count,
  onClose,
  onSaved,
  onDelete,
  onDirtyChange,
  initial,
  original,
}: PopupEditorProps & { initial: PopupFormValues; original: AdminPopup | null }) {
  const formId = useId();
  const { toast } = useToast();
  const save = useSavePopup();
  const [uploading, setUploading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    trigger,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<PopupFormValues>({
    resolver: zodResolver(popupFormSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });
  const values = watch();
  const set = <K extends keyof PopupFormValues>(name: K, value: PopupFormValues[K]) => {
    setValue(name as never, value as never, { shouldDirty: true, shouldValidate: isSubmitted });
    if (!isSubmitted) clearErrors(name);
    setFormError(null);
  };

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const size = Math.max(1, count + (original ? 0 : 1));
  const position = resolvePosition(values.position, size);
  const datesValid = isDay(values.startDate) && isDay(values.endDate);
  const status = datesValid
    ? scheduleStatus({
        paused: values.paused,
        startAt: startOfKstDay(values.startDate),
        endAt: endOfKstDay(values.endDate),
      })
    : null;
  const dismissOptions = [...new Set([...DISMISS_PRESETS, values.dismissDays])]
    .filter((d) => Number.isInteger(d) && d >= 0)
    .sort((a, b) => a - b);

  const submit = handleSubmit(async (form) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        id: mode === 'edit' ? popupId : null,
        input: toPopupInput(form, { clear: mode === 'edit' }),
        position: requestedPosition(form.position, size, !original),
      });
      onDirtyChange?.(false);
      toast(mode === 'edit' ? '팝업을 저장했어요' : '팝업을 등록했어요');
      onSaved(saved, mode);
    } catch (e) {
      if (e instanceof ApiError && e.isValidation) {
        const mapped = Object.entries(e.fieldErrors()).filter(([path, message]) => {
          const field = SERVER_FIELD[path.split('.')[0] ?? ''];
          if (!field) return false;
          setError(field, { message });
          return true;
        });
        setFormError(mapped.length > 0 ? '입력값을 확인해 주세요.' : errorMessage(e));
      } else if (e instanceof ApiError && e.code === 'BANNER_INVALID_LINK') {
        setError('linkUrl', { message: LINK_URL_MESSAGE });
        setFormError('입력값을 확인해 주세요.');
      } else {
        setFormError(errorMessage(e));
      }
    }
  });

  const requestClose = () => (isDirty ? setConfirmClose(true) : onClose());
  const code = original ? displayCode(original) : mode === 'copy' ? '복사본' : '새 팝업';

  return (
    <EditorPanel
      eyebrow={`${code} · 공지 팝업`}
      title={TITLES[mode]}
      status={
        status && <StatusPill tone={STATUS_TONE[status]}>{STATUS_PILL_LABEL[status]}</StatusPill>
      }
      onClose={requestClose}
    >
      <EditorBody>
        <PopupPreview
          title={values.title}
          src={values.image?.url ?? null}
          dismissDays={values.dismissDays}
          targetPages={values.targetPages}
        />
        <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
          <FormField
            label="제목"
            note="관리용"
            htmlFor={`${formId}-title`}
            required
            error={errors.title?.message}
            errorId={`${formId}-title-err`}
          >
            <span className={styles.affix}>
              <Input
                id={`${formId}-title`}
                className={cx(styles.inMd, !!errors.title && styles.invalid)}
                maxLength={TITLE_MAX}
                autoComplete="off"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? `${formId}-title-err` : undefined}
                aria-required="true"
                {...register('title')}
              />
              <span aria-hidden="true">
                {values.title.length}/{TITLE_MAX}
              </span>
            </span>
          </FormField>

          <div className={styles.g2}>
            <ImageUploadField
              label="팝업 이미지"
              value={values.image}
              onChange={(v) => set('image', v)}
              spec={POPUP_IMAGE_SPEC}
              purpose={MediaPurpose.POPUP}
              required
              error={errors.image?.message}
              onBusyChange={setUploading}
            />
            <FormField
              label="닫기 옵션"
              htmlFor={`${formId}-dismiss`}
              error={errors.dismissDays?.message}
              help={
                values.dismissDays > 0
                  ? `‘${dismissLabel(values.dismissDays)}’을 누르면 그 기간 동안 다시 뜨지 않아요.`
                  : '닫기 버튼만 보여요. 방문할 때마다 다시 떠요.'
              }
            >
              <Select
                id={`${formId}-dismiss`}
                className={styles.inMd}
                value={String(values.dismissDays)}
                onChange={(e) => set('dismissDays', Number(e.target.value))}
                options={dismissOptions.map((d) => ({
                  value: String(d),
                  label: d === 0 ? '표시 안 함' : dismissLabel(d),
                }))}
              />
            </FormField>
          </div>

          <LinkField
            value={values.linkUrl}
            onChange={(v) => set('linkUrl', v)}
            onBlur={() => {
              if (values.linkUrl.trim()) void trigger('linkUrl');
            }}
            newWindow={values.newWindow}
            onNewWindowChange={(v) => set('newWindow', v)}
            error={errors.linkUrl?.message}
          />

          <FormField
            label="노출 페이지"
            labelId={`${formId}-pages`}
            required
            error={errors.targetPages?.message}
            help="‘전체 페이지’를 고르면 모든 화면에서 한 번씩 보여요."
          >
            <div className={styles.pageChips} role="group" aria-labelledby={`${formId}-pages`}>
              {POPUP_PAGES.map((page: PopupPage) => (
                <Chip
                  key={page}
                  selected={values.targetPages.includes(page)}
                  onClick={() => set('targetPages', togglePopupPage(values.targetPages, page))}
                >
                  {POPUP_PAGE_LABEL[page]}
                </Chip>
              ))}
            </div>
          </FormField>

          <div className={cx(styles.g2, styles.g2Per)}>
            <DateRangeField
              startDate={values.startDate}
              endDate={values.endDate}
              onChange={(patch) => {
                if (patch.startDate !== undefined) set('startDate', patch.startDate);
                if (patch.endDate !== undefined) set('endDate', patch.endDate);
              }}
              startError={errors.startDate?.message}
              endError={errors.endDate?.message}
            />
            <FormField label="노출 순서" htmlFor={`${formId}-pos`}>
              <Select
                id={`${formId}-pos`}
                className={styles.inMd}
                value={String(position)}
                onChange={(e) => set('position', Number(e.target.value))}
                options={Array.from({ length: size }, (_, i) => ({
                  value: String(i + 1),
                  label: `${i + 1}번째 / ${size}개`,
                }))}
              />
            </FormField>
          </div>

          <StatusField
            value={{ paused: values.paused, startDate: values.startDate, endDate: values.endDate }}
            onChange={(next) => {
              set('paused', next.paused);
              set('startDate', next.startDate);
              set('endDate', next.endDate);
            }}
          />

          {formError && (
            <p className={styles.err} role="alert">
              {formError}
            </p>
          )}
        </form>
      </EditorBody>
      <EditorFooter>
        {original && (
          <Button
            variant="ghost"
            size="sm"
            className={styles.del}
            iconLeft={<Icon name="trash" size={16} />}
            onClick={() => onDelete(original)}
          >
            삭제
          </Button>
        )}
        <span className={styles.ftSp} />
        <Button variant="secondary" onClick={requestClose}>
          취소
        </Button>
        <Button type="submit" form={formId} loading={save.isPending} disabled={uploading}>
          저장
        </Button>
      </EditorFooter>
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        title="저장하지 않고 닫을까요?"
        description="바꾼 내용은 저장되지 않아요."
        confirmLabel="닫기"
        cancelLabel="계속 편집"
      />
    </EditorPanel>
  );
}
