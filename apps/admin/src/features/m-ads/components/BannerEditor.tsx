'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { BANNER_SLOT_SPECS, BannerStatus, MediaPurpose, type BannerSlot } from '@house/shared';
import {
  Button,
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { useBanner, useRegions, useSaveBanner, useSlotBanners } from '../api/hooks';
import type { AdminBanner, BannerSlotInfo } from '../api/schemas';
import {
  bannerFormSchema,
  bannerToForm,
  duplicateToForm,
  emptyBannerForm,
  LAST_POSITION,
  LINK_URL_MESSAGE,
  requestedPosition,
  resolvePosition,
  TITLE_MAX,
  toBannerInput,
  toBannerUpdateInput,
  type BannerFormValues,
} from '../lib/banner-form';
import { endOfKstDay, isDay, startOfKstDay } from '../lib/dates';
import { isMobileOnlySlot, SLOT_META, SLOT_ORDER, slotLabel, slotSpecText } from '../lib/slots';
import { displayCode, scheduleStatus, STATUS_PILL_LABEL, STATUS_TONE } from '../lib/status';
import { withRegionNames } from '../lib/summary';
import { AdvertiserField } from './AdvertiserField';
import styles from './editor.module.css';
import { EditorBody, EditorFooter, EditorPanel } from './EditorPanel';
import { FormField } from './FormField';
import { ImageUploadField } from './ImageUploadField';
import { LinkField } from './LinkField';
import { LivePreview } from './LivePreview';
import { DateRangeField, StatusField } from './ScheduleFields';
import { TargetingField } from './TargetingField';

export type EditorMode = 'new' | 'edit' | 'copy';

export interface BannerEditorProps {
  mode: EditorMode;
  /** Banner being edited, or the source of a copy. */
  bannerId: string | null;
  /** Preselected slot for a new banner (the list filter). */
  initialSlot?: BannerSlot;
  slots: readonly BannerSlotInfo[] | undefined;
  onClose: () => void;
  onSaved: (banner: AdminBanner, mode: EditorMode) => void;
  onDelete: (banner: AdminBanner) => void;
  onDirtyChange?: (dirty: boolean) => void;
  statsHref: (id: string) => string;
}

const TITLES: Record<EditorMode, string> = {
  new: '새 배너 등록',
  edit: '배너 수정',
  copy: '배너 복제',
};

/** Backend field path → form field (for `VALIDATION_FAILED` details). */
const SERVER_FIELD: Record<string, keyof BannerFormValues> = {
  slot: 'slot',
  title: 'title',
  advertiserName: 'advertiserName',
  agencyId: 'advertiserName',
  pcMediaId: 'pcImage',
  mobileMediaId: 'mobileImage',
  linkUrl: 'linkUrl',
  startAt: 'startDate',
  endAt: 'endDate',
  targeting: 'targeting',
  targetRegionCodes: 'regions',
  targetComplexIds: 'complexes',
  memo: 'memo',
};

/** Edit drawer for one banner (create / edit / duplicate) with the live preview on top. */
export function BannerEditor(props: BannerEditorProps) {
  const { mode, bannerId, initialSlot, onClose } = props;
  const source = useBanner(mode === 'new' ? null : bannerId);
  const newSlot = initialSlot ?? SLOT_ORDER[0];
  // The banner view only has region codes: load the names before the form is built (the chips
  // would show bare codes otherwise). A failed region list falls back to the codes.
  const needsRegions = !!source.data && source.data.targetRegionCodes.length > 0;
  const regions = useRegions(needsRegions);
  const regionsReady = !needsRegions || regions.isSuccess || regions.isError;

  // New banners and copies start at LAST_POSITION, so the defaults never depend on counts that may
  // still be loading (a deep link to ?new=1 used to default to the top of the slot).
  const initial = useMemo<BannerFormValues | null>(() => {
    if (mode === 'new') return emptyBannerForm(newSlot);
    if (!source.data || !regionsReady) return null;
    const banner = withRegionNames(source.data, regions.data?.items);
    return mode === 'edit' ? bannerToForm(banner) : duplicateToForm(banner);
  }, [mode, source.data, newSlot, regionsReady, regions.data]);

  if (initial)
    return (
      <BannerForm
        key={`${mode}:${bannerId ?? 'new'}`}
        {...props}
        initial={initial}
        original={mode === 'edit' ? (source.data ?? null) : null}
      />
    );

  return (
    <EditorPanel title={TITLES[mode]} onClose={onClose}>
      <EditorBody>
        {source.isError ? (
          <ErrorState
            compact
            title={
              source.error instanceof ApiError && source.error.isNotFound
                ? '배너를 찾을 수 없어요'
                : '배너를 불러오지 못했어요'
            }
            description={
              source.error instanceof ApiError && source.error.isNotFound
                ? '이미 삭제되었을 수 있어요. 목록을 새로 고쳐 확인해 주세요.'
                : undefined
            }
            onRetry={() => void source.refetch()}
          />
        ) : (
          <div className={styles.skForm} role="status" aria-label="배너 불러오는 중">
            <Skeleton height={190} radius={14} />
            <Skeleton height={42} radius={10} />
            <Skeleton height={42} radius={10} />
            <Skeleton height={112} radius={12} />
            <Skeleton height={42} radius={10} />
            <Skeleton height={42} radius={10} />
          </div>
        )}
      </EditorBody>
    </EditorPanel>
  );
}

function BannerForm({
  mode,
  bannerId,
  slots,
  onClose,
  onSaved,
  onDelete,
  onDirtyChange,
  statsHref,
  initial,
  original,
}: BannerEditorProps & { initial: BannerFormValues; original: AdminBanner | null }) {
  const formId = useId();
  const router = useRouter();
  const { toast } = useToast();
  const save = useSaveBanner();
  const [uploads, setUploads] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  /** Page to open once the user agreed to drop the unsaved edits (footer "통계" link). */
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
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
  } = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });
  const values = watch();
  const set = <K extends keyof BannerFormValues>(name: K, value: BannerFormValues[K]) => {
    // react-hook-form's path typing does not narrow generic keys; the pair is type-safe by K.
    setValue(name as never, value as never, { shouldDirty: true, shouldValidate: isSubmitted });
    if (!isSubmitted) clearErrors(name);
    setFormError(null);
  };

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  /** The API keeps a banner in the slot it was created in (no `slot` in `bannerUpdateSchema`). */
  const slotLocked = mode === 'edit';
  const slotInfo = slots?.find((s) => s.slot === values.slot);
  const spec = slotInfo ?? { slot: values.slot, ...BANNER_SLOT_SPECS[values.slot] };
  const mobileOnly = isMobileOnlySlot(values.slot);

  // Order select: positions inside the chosen slot.
  const slotAll = useSlotBanners(values.slot);
  const inSlotAlready = original?.slot === values.slot;
  const slotSize = (slotAll.data?.total ?? slotInfo?.totalCount ?? 0) + (inSlotAlready ? 0 : 1);
  const position = resolvePosition(values.position, slotSize);

  const changeSlot = (slot: BannerSlot) => {
    set('slot', slot);
    // Another slot: the backend appends the banner there (shown as the last place).
    set('position', original?.slot === slot ? original.sortOrder : LAST_POSITION);
    if (BANNER_SLOT_SPECS[slot].mobile === null || isMobileOnlySlot(slot)) set('mobileImage', null);
    if (!original && values.regions.length === 0 && values.complexes.length === 0)
      set('targeting', SLOT_META[slot].defaultTargeting);
  };

  const schedule = { paused: values.paused, startDate: values.startDate, endDate: values.endDate };
  const datesValid = isDay(values.startDate) && isDay(values.endDate);
  const status = datesValid
    ? scheduleStatus({
        paused: values.paused,
        startAt: startOfKstDay(values.startDate),
        endAt: endOfKstDay(values.endDate),
      })
    : null;
  const wasLiveHere = original?.status === BannerStatus.ACTIVE && inSlotAlready;
  const slotFull =
    status === BannerStatus.ACTIVE &&
    !wasLiveHere &&
    slotInfo !== undefined &&
    slotInfo.activeCount !== null &&
    slotInfo.activeCount >= slotInfo.maxActive;

  const submit = handleSubmit(async (form) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync({
        id: mode === 'edit' ? bannerId : null,
        // PATCH never carries the slot (immutable, `bannerUpdateSchema` is strict).
        input: mode === 'edit' ? toBannerUpdateInput(form) : toBannerInput(form),
        position: requestedPosition(form.position, slotSize, !inSlotAlready),
      });
      onDirtyChange?.(false);
      toast(mode === 'edit' ? '배너를 저장했어요' : '배너를 등록했어요');
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
      } else if (e instanceof ApiError && e.code === 'BANNER_SLOT_FULL') {
        setFormError(
          `이 위치는 동시에 ${slotInfo?.maxActive ?? ''}개까지만 노출할 수 있어요. ‘중지’나 ‘예약’으로 저장하거나, 노출 중인 배너를 먼저 내려 주세요.`,
        );
      } else {
        setFormError(errorMessage(e));
      }
    }
  });

  const requestClose = () => (isDirty ? setConfirmClose(true) : onClose());
  const code = original ? displayCode(original) : mode === 'copy' ? '복사본' : '새 배너';
  const titleLength = values.title.length;

  return (
    <EditorPanel
      eyebrow={`${code} · ${slotLabel(values.slot, slots)}`}
      title={TITLES[mode]}
      status={
        status && <StatusPill tone={STATUS_TONE[status]}>{STATUS_PILL_LABEL[status]}</StatusPill>
      }
      onClose={requestClose}
    >
      <EditorBody>
        <LivePreview
          slot={values.slot}
          info={slotInfo}
          title={values.title}
          pcUrl={values.pcImage?.url ?? null}
          mobileUrl={values.mobileImage?.url ?? null}
          position={position}
        />
        <form id={formId} className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
          <FormField
            label="노출 위치"
            htmlFor={`${formId}-slot`}
            required
            help={
              slotLocked
                ? '노출 위치는 등록한 뒤에는 바꿀 수 없어요. 다른 위치에 걸려면 복제해서 등록해 주세요.'
                : undefined
            }
          >
            <Select
              id={`${formId}-slot`}
              className={styles.inMd}
              value={values.slot}
              disabled={slotLocked}
              onChange={(e) => changeSlot(e.target.value as BannerSlot)}
              options={SLOT_ORDER.map((slot) => {
                const info = slots?.find((s) => s.slot === slot);
                const text = slotSpecText(info ?? { slot, ...BANNER_SLOT_SPECS[slot] });
                return { value: slot, label: `${slotLabel(slot, slots)} · ${text}` };
              })}
            />
          </FormField>

          <div className={styles.g2}>
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
                  {titleLength}/{TITLE_MAX}
                </span>
              </span>
            </FormField>
            <AdvertiserField
              value={{ advertiserName: values.advertiserName, agency: values.agency }}
              onChange={(next) => {
                set('advertiserName', next.advertiserName);
                set('agency', next.agency);
              }}
              error={errors.advertiserName?.message}
            />
          </div>

          <div className={styles.g2}>
            <ImageUploadField
              label={mobileOnly ? '배너 이미지' : 'PC 이미지'}
              value={values.pcImage}
              onChange={(v) => set('pcImage', v)}
              spec={spec.pc}
              purpose={MediaPurpose.BANNER}
              required
              error={errors.pcImage?.message}
              onBusyChange={(busy) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)))}
            />
            <ImageUploadField
              label="모바일 이미지"
              value={values.mobileImage}
              onChange={(v) => set('mobileImage', v)}
              spec={spec.mobile ?? spec.pc}
              purpose={MediaPurpose.BANNER}
              error={errors.mobileImage?.message}
              unavailable={
                mobileOnly
                  ? '모바일 전용 위치예요. 왼쪽 이미지가 쓰여요'
                  : spec.mobile === null
                    ? '이 위치는 모바일에 노출되지 않아요'
                    : undefined
              }
              onBusyChange={(busy) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)))}
            />
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
                options={Array.from({ length: Math.max(1, slotSize) }, (_, i) => ({
                  value: String(i + 1),
                  label: `${i + 1}번째 / ${Math.max(1, slotSize)}개`,
                }))}
              />
            </FormField>
          </div>

          <TargetingField
            value={{
              targeting: values.targeting,
              regions: values.regions,
              complexes: values.complexes,
            }}
            onChange={(next) => {
              set('targeting', next.targeting);
              set('regions', next.regions);
              set('complexes', next.complexes);
            }}
            regionsError={errors.regions?.message}
            complexesError={errors.complexes?.message}
          />

          <StatusField
            value={schedule}
            onChange={(next) => {
              set('paused', next.paused);
              set('startDate', next.startDate);
              set('endDate', next.endDate);
            }}
          />
          {slotFull && (
            <p className={styles.err} role="status">
              이 위치는 이미 {slotInfo?.activeCount}/{slotInfo?.maxActive}개가 노출 중이에요.
              ‘중지’나 ‘예약’으로 저장할 수 있어요.
            </p>
          )}

          <FormField
            label="메모"
            note="관리용 · 중지 사유 등"
            htmlFor={`${formId}-memo`}
            error={errors.memo?.message}
          >
            <Input
              id={`${formId}-memo`}
              className={cx(styles.inMd, !!errors.memo && styles.invalid)}
              autoComplete="off"
              placeholder="예: 광고주 요청으로 일시 중지"
              {...register('memo')}
            />
          </FormField>

          {formError && (
            <p className={styles.err} role="alert">
              {formError}
            </p>
          )}
        </form>
      </EditorBody>
      <EditorFooter>
        {original && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={styles.del}
              iconLeft={<Icon name="trash" size={16} />}
              onClick={() => onDelete(original)}
            >
              삭제
            </Button>
            {/* Capture phase: stop the link (and Next's client navigation) while edits are unsaved. */}
            <span
              className={styles.ftLinkWrap}
              onClickCapture={(e) => {
                if (!isDirty) return;
                e.preventDefault();
                setLeaveTo(statsHref(original.id));
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                className={styles.ftLink}
                href={statsHref(original.id)}
                linkAs={Link}
                iconLeft={<Icon name="chart" size={16} />}
              >
                통계
              </Button>
            </span>
          </>
        )}
        <span className={styles.ftSp} />
        <Button variant="secondary" onClick={requestClose}>
          취소
        </Button>
        <Button type="submit" form={formId} loading={save.isPending} disabled={uploads > 0}>
          저장
        </Button>
      </EditorFooter>
      <ConfirmDialog
        open={confirmClose || leaveTo !== null}
        onClose={() => {
          setConfirmClose(false);
          setLeaveTo(null);
        }}
        onConfirm={() => {
          setConfirmClose(false);
          if (leaveTo) {
            onDirtyChange?.(false);
            router.push(leaveTo);
          } else onClose();
        }}
        title={leaveTo ? '저장하지 않고 이동할까요?' : '저장하지 않고 닫을까요?'}
        description="바꾼 내용은 저장되지 않아요."
        confirmLabel={leaveTo ? '이동' : '닫기'}
        cancelLabel="계속 편집"
      />
    </EditorPanel>
  );
}
