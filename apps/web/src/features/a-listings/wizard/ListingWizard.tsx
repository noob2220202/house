'use client';
import { LISTING_STATUS_LABEL, ListingStatus } from '@house/shared';
import {
  Button,
  Callout,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  Skeleton,
  StatusPill,
  cx,
  useToast,
} from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { agencyKeys, fetchMyAgency } from '@/features/a-agency/api/queries';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ConsolePage, ConsolePageHeader } from '@/features/a-agency/shell';
import { ROUTES } from '@/config/nav';
import { ApiError, errorMessage } from '@/lib/api';
import {
  addVerification as postVerification,
  createListing,
  fetchComplex,
  fetchListing,
  listingKeys,
  publishListing,
  saveListingPhotos,
  updateListing,
  type VerificationInput,
} from '../api/queries';
import type { AgencyListing, AgencyListingAgency, ComplexForListing } from '../api/schemas';
import {
  FIELD_STEP,
  FORM_DEFAULTS,
  LAST_STEP,
  STEPS,
  canSaveDraft,
  formFieldOf,
  fromListing,
  schemaIssues,
  stepIndexOf,
  toDraftPayload,
  toUpdatePayload,
  type DraftPayload,
  type FormField,
  type ListingFormValues,
} from '../lib/form';
import { samePhotos, type PhotoValue } from '../lib/photos';
import {
  mapServerFieldErrors,
  publishRequirements,
  type ServerFieldDetail,
} from '../lib/requirements';
import { isLeaveTarget } from '../lib/leave';
import { STATUS_TONE } from '../lib/status';
import { editStepHref } from '../routes';
import { Checklist } from './Checklist';
import { WizardContext, type WizardContextValue } from './context';
import { StepDeal } from './StepDeal';
import { StepDescription } from './StepDescription';
import { StepDetail } from './StepDetail';
import { StepPhotos } from './StepPhotos';
import { StepProperty } from './StepProperty';
import { StepVerify } from './StepVerify';
import styles from './wizard.module.css';
import { formatTimeOfDay } from '@/lib/format';

/**
 * The preview step pulls in the public listing page (gallery, lightbox, facts, map) — loaded only
 * when the broker gets there so the first six steps stay light.
 */
const StepPreview = dynamic(() => import('./StepPreview').then((m) => m.StepPreview), {
  ssr: false,
  loading: () => (
    <div className={styles.skeleton} role="status" aria-label="미리보기를 불러오는 중">
      <Skeleton height={132} radius={16} />
      <Skeleton height={360} radius={16} />
      <Skeleton width="50%" height={32} />
      <Skeleton width="30%" height={44} />
    </div>
  ),
});

export interface ListingWizardProps {
  /** Listing to edit; omit for a new listing. */
  listingId?: string;
}

const toPhotoValues = (l: AgencyListing): PhotoValue[] =>
  l.photos.map((p) => ({
    mediaId: p.mediaId,
    url: p.url,
    thumbUrl: p.thumbUrl ?? null,
    caption: p.caption ?? '',
    isCover: p.isCover,
  }));

const signature = (values: ListingFormValues) => JSON.stringify(toDraftPayload(values).payload);

interface AlertItem {
  label: string;
  /** Wizard field the item maps to (null = office-side item without a field). */
  field: FormField | null;
}

/** One alert row per server detail, labelled by the validator (`label`) or its message / path. */
function alertItems(details: readonly ServerFieldDetail[], draft: DraftPayload): AlertItem[] {
  const items: AlertItem[] = [];
  for (const d of details) {
    const path = d.field ?? d.path ?? '';
    const label = d.label ?? d.message ?? path;
    if (!label || items.some((i) => i.label === label)) continue;
    items.push({ label, field: path ? formFieldOf(path, draft) : null });
  }
  return items;
}

const timeText = (d: Date) => formatTimeOfDay(d);

/**
 * Listing create / edit wizard: 종류·소재지 → 거래·가격 → 면적·상세 → 사진 → 설명·옵션 → 실매물 확인 →
 * 미리보기·게시. The draft is saved to the server whenever the broker moves between steps, so the
 * work survives a reload and can be continued by a colleague.
 */
export function ListingWizard({ listingId: initialId }: ListingWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<ListingFormValues>({
    defaultValues: FORM_DEFAULTS,
    shouldFocusError: false,
  });
  const [listing, setListing] = useState<AgencyListing | null>(null);
  const [complex, setComplex] = useState<ComplexForListing | null>(null);
  const [photos, setPhotos] = useState<PhotoValue[]>([]);
  // A new listing always starts at step 1 (`/new?step=preview` would show an empty preview).
  const [step, setStep] = useState(() => (initialId ? stepIndexOf(searchParams.get('step')) : 0));
  const [maxReached, setMaxReached] = useState(initialId ? LAST_STEP : 0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /** A 실매물 확인 is being recorded — moving on or publishing waits for it. */
  const [verifying, setVerifying] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /** Server-side field errors; items with a `field` jump to it. */
  const [alert, setAlert] = useState<{ title: string; items: AlertItem[] } | null>(null);
  /** In-app link clicked while edits are unsaved (the leave dialog is open). */
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  const lastSig = useRef(signature(FORM_DEFAULTS));
  const savedPhotos = useRef<PhotoValue[]>([]);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  /** Always-current id for callbacks created before the first save finished. */
  const idRef = useRef<string | null>(initialId ?? null);
  const uploading = useRef(0);
  const pendingFocus = useRef<FormField | null>(null);
  const headingRef = useRef<HTMLSpanElement>(null);
  const hydrated = useRef(false);

  // ---- load (edit) ---------------------------------------------------------------------------
  const query = useQuery({
    queryKey: listingKeys.detail(initialId ?? ''),
    queryFn: ({ signal }) => fetchListing(initialId ?? '', signal),
    enabled: !!initialId,
    staleTime: Infinity,
    gcTime: 0,
  });

  const hydrate = useCallback(
    (l: AgencyListing) => {
      const values = fromListing(l);
      form.reset(values);
      lastSig.current = signature(values);
      const loaded = toPhotoValues(l);
      setPhotos(loaded);
      savedPhotos.current = loaded;
      setListing(l);
      idRef.current = l.id;
    },
    [form],
  );

  useEffect(() => {
    if (query.data && !hydrated.current) {
      hydrated.current = true;
      hydrate(query.data);
    }
  }, [query.data, hydrate]);

  // Complex of a loaded listing (pre-fill source for 평형 / 세대당 주차 and the preview).
  const complexId = listing?.property.complexId ?? null;
  const complexQuery = useQuery({
    queryKey: listingKeys.complex(complexId ?? ''),
    queryFn: ({ signal }) => fetchComplex(complexId ?? '', signal),
    enabled: !!complexId && complex?.id !== complexId,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (complexQuery.data && complexQuery.data.id === form.getValues('complexId')) {
      setComplex(complexQuery.data);
    }
  }, [complexQuery.data, form]);

  // The caller's office — disclosure block of the preview for listings that are not saved yet.
  const agencyQuery = useQuery({
    queryKey: agencyKeys.mine,
    queryFn: ({ signal }) => fetchMyAgency(signal),
    staleTime: 5 * 60_000,
  });
  const agencies = useMemo<AgencyListingAgency[]>(() => {
    if (listing && listing.agencies.length > 0) return listing.agencies;
    const a = agencyQuery.data;
    if (!a) return [];
    return [
      {
        agencyId: a.id,
        isPrimary: true,
        name: a.name,
        representativeName: a.representativeName,
        registrationNumber: a.registrationNumber,
        phone: a.phone,
        roadAddress: a.roadAddress,
        addressDetail: a.addressDetail ?? null,
        logoUrl: a.logo?.variants.thumb?.url ?? null,
        contactName: a.representativeName,
        contactPhone: a.mobile ?? a.phone,
      },
    ];
  }, [listing, agencyQuery.data]);

  // ---- step navigation -------------------------------------------------------------------------
  const syncUrl = useCallback((id: string | null, index: number) => {
    const key = STEPS[index]?.key ?? STEPS[0].key;
    const url = id ? editStepHref(id, key) : `${AGENT_ROUTES.listingNew}?step=${key}`;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const focusField = useCallback((field: FormField) => {
    const el = document.getElementById(`f-${field}`);
    if (!el) return;
    const target = el.matches('input, select, textarea, button')
      ? el
      : (el.querySelector<HTMLElement>('input:checked, input, button, select, textarea') ?? el);
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
    target.focus({ preventScroll: true });
  }, []);

  const show = useCallback(
    (index: number, focus?: FormField) => {
      pendingFocus.current = focus ?? null;
      setStep(index);
      setMaxReached((m) => Math.max(m, index));
      syncUrl(idRef.current, index);
      if (index === step && focus) focusField(focus);
    },
    [step, syncUrl, focusField],
  );

  // After a step change: focus the requested field, or the heading (screen readers + scroll top).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const field = pendingFocus.current;
    pendingFocus.current = null;
    if (field) {
      requestAnimationFrame(() => focusField(field));
    } else {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [step, focusField]);

  // ---- validation ------------------------------------------------------------------------------
  const applyErrors = useCallback(
    (errors: readonly { field: FormField; message: string }[]) => {
      for (const e of errors) form.setError(e.field, { type: 'manual', message: e.message });
    },
    [form],
  );

  /** Format problems + missing 명시사항 of one step. Returns the first invalid field, if any. */
  const validateStep = useCallback(
    (index: number): FormField | null => {
      const { payload, issues } = toDraftPayload(form.getValues());
      const found = new Map<FormField, string>();
      for (const i of [...issues, ...schemaIssues(payload)]) {
        if (FIELD_STEP[i.field] === index && !found.has(i.field)) found.set(i.field, i.message);
      }
      for (const r of publishRequirements(payload)) {
        if (r.step === index && !r.done && !found.has(r.formField)) {
          found.set(r.formField, r.message);
        }
      }
      const fields = (Object.keys(FIELD_STEP) as FormField[]).filter(
        (f) => FIELD_STEP[f] === index,
      );
      form.clearErrors(fields);
      const errors = [...found].map(([field, message]) => ({ field, message }));
      applyErrors(errors);
      return errors[0]?.field ?? null;
    },
    [form, applyErrors],
  );

  const handleServerError = useCallback(
    (error: unknown, fallbackTitle: string) => {
      if (
        error instanceof ApiError &&
        (error.code === 'LISTING_PUBLISH_REQUIREMENTS' || error.isValidation) &&
        error.details?.length
      ) {
        const details: ServerFieldDetail[] = error.details;
        const draft = toDraftPayload(form.getValues()).payload;
        const { errors } = mapServerFieldErrors(details, draft);
        applyErrors(errors.map((e) => ({ field: e.formField, message: e.message })));
        setAlert({
          title:
            error.code === 'LISTING_PUBLISH_REQUIREMENTS'
              ? `필수 표시사항 ${details.length}개가 비어 있어 게시하지 못했어요`
              : fallbackTitle,
          items: alertItems(details, draft),
        });
        const first = errors[0];
        if (first) show(first.step, first.formField);
        return;
      }
      toast({ message: errorMessage(error), tone: 'error' });
    },
    [form, applyErrors, show, toast],
  );

  // ---- persistence -----------------------------------------------------------------------------
  /** Saves the draft (and the photo order) when something changed. Null = could not save. */
  const persist = useCallback(async (): Promise<AgencyListing | null> => {
    const { payload, issues } = toDraftPayload(form.getValues());
    if (issues.length > 0) {
      applyErrors(issues);
      const first = issues[0];
      if (first) show(FIELD_STEP[first.field], first.field);
      return null;
    }
    if (!canSaveDraft(payload)) {
      const invalid = validateStep(0);
      show(0, invalid ?? 'assetType');
      return null;
    }
    if (uploading.current > 0) {
      toast({ message: '사진을 올리는 중이에요. 잠시만 기다려 주세요.', tone: 'info' });
      return null;
    }
    setSaving(true);
    try {
      let current = listing;
      let id = idRef.current;
      const sig = JSON.stringify(payload);
      if (!id) {
        current = await createListing(payload);
        id = current.id;
        idRef.current = id;
        syncUrl(id, step);
      } else if (sig !== lastSig.current || !current) {
        current = await updateListing(id, toUpdatePayload(payload, current?.version));
      }
      lastSig.current = sig;
      const nextPhotos = photosRef.current;
      if (!samePhotos(nextPhotos, savedPhotos.current)) {
        await saveListingPhotos(id, nextPhotos);
        savedPhotos.current = nextPhotos;
        // The photo call answers with the photos only: reload the listing (cover, new `version`).
        current = await fetchListing(id);
      }
      if (current) setListing(current);
      setSavedAt(new Date());
      setAlert(null);
      void queryClient.invalidateQueries({ queryKey: listingKeys.all });
      return current;
    } catch (error) {
      handleServerError(error, '저장하지 못했어요. 표시된 항목을 확인해 주세요.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    form,
    applyErrors,
    show,
    validateStep,
    toast,
    listing,
    syncUrl,
    step,
    queryClient,
    handleServerError,
  ]);

  const published = !!listing && listing.status !== ListingStatus.DRAFT;
  const busy = saving || publishing || verifying;

  const goTo = useCallback(
    async (target: number, focus?: FormField) => {
      if (busy) return;
      if (target === step) {
        if (focus) focusField(focus);
        return;
      }
      if (target > step) {
        const invalid = validateStep(step);
        if (invalid) {
          focusField(invalid);
          return;
        }
      }
      const saved = await persist();
      // Moving forward needs a saved draft; going back to fix something is always allowed.
      if (!saved && target > step) return;
      show(target, focus);
    },
    [busy, step, validateStep, focusField, persist, show],
  );

  const addVerification = useCallback(
    async (input: VerificationInput): Promise<boolean> => {
      setVerifying(true);
      try {
        const saved = await persist();
        if (!saved) return false;
        const next = await postVerification(saved.id, input);
        setListing(next);
        void queryClient.invalidateQueries({ queryKey: listingKeys.all });
        toast({ message: '실매물 확인을 기록했어요.' });
        return true;
      } catch (error) {
        toast({ message: errorMessage(error), tone: 'error' });
        return false;
      } finally {
        setVerifying(false);
      }
    },
    [persist, queryClient, toast],
  );

  const finish = async () => {
    const saved = await persist();
    if (!saved) return;
    if (saved.status !== ListingStatus.DRAFT) {
      toast({ message: '변경 내용을 저장했어요.' });
      router.push(AGENT_ROUTES.listings);
      return;
    }
    setPublishing(true);
    try {
      await publishListing(saved.id);
      void queryClient.invalidateQueries({ queryKey: listingKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['agencies'] });
      toast({
        message: '매물을 게시했어요. 지도와 목록에 곧 보여요.',
        action: { label: '공개 페이지', href: ROUTES.listing(saved.id) },
      });
      router.push(`${AGENT_ROUTES.listings}?status=ACTIVE`);
    } catch (error) {
      handleServerError(error, '게시하지 못했어요. 표시된 항목을 확인해 주세요.');
    } finally {
      setPublishing(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < LAST_STEP) void goTo(step + 1);
    else void finish();
  };

  const saveDraftNow = async () => {
    const saved = await persist();
    if (saved) toast({ message: '임시저장했어요. 매물 관리의 ‘작성중’에서 이어서 쓸 수 있어요.' });
  };

  // Typing into a field clears its (manually set) error; the step is re-validated on 다음.
  useEffect(() => {
    const subscription = form.watch((_values, { name, type }) => {
      if (name && type === 'change') form.clearErrors(name);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Warn before leaving with unsaved edits: reloads / closing the tab (`beforeunload`) and in-app
  // links (sidebar, 매물 목록, 취소 …), which navigate client-side without any browser prompt.
  const isDirty = useCallback(
    () =>
      signature(form.getValues()) !== lastSig.current ||
      !samePhotos(photosRef.current, savedPhotos.current),
    [form],
  );
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault();
    };
    // Capture phase on the document runs before React's root listener (and so before next/link).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
      // The preview frame blocks its own links (see StepPreview).
      if (!(anchor instanceof HTMLAnchorElement) || anchor.closest('[data-preview-frame]')) return;
      const to = isLeaveTarget(
        { href: anchor.href, target: anchor.target, download: anchor.hasAttribute('download') },
        window.location.href,
      );
      if (!to || !isDirty()) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(to);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [isDirty]);

  const leave = async (save: boolean) => {
    const to = leaveTo;
    if (!to) return;
    if (save) {
      const saved = await persist();
      // Could not save → the step with the problem is shown; stay.
      if (!saved) {
        setLeaveTo(null);
        return;
      }
    }
    setLeaveTo(null);
    router.push(to);
  };

  const setUploading = useCallback((count: number) => {
    uploading.current = count;
  }, []);

  const errorSteps = new Set(
    (Object.keys(form.formState.errors) as FormField[]).map((f) => FIELD_STEP[f]),
  );

  const ctx: WizardContextValue = {
    listing,
    complex,
    setComplex,
    photos,
    setPhotos,
    setUploading,
    verifications: listing?.verifications ?? [],
    addVerification,
    agencies,
    goToStep: (index) => void goTo(index),
    goToField: (field) => void goTo(FIELD_STEP[field], field),
    assetLocked: published,
    busy,
  };

  // ---- render ----------------------------------------------------------------------------------
  const editing = !!initialId;
  /** `formHint` = the "* 필수 / 자동 저장" line, shown only above the editable form. */
  const header = (title: string, formHint = false) => (
    <ConsolePageHeader
      eyebrow={
        <>
          {editing ? '매물 수정' : '매물 등록'}
          {listing?.listingNo && <> · 매물번호 {listing.listingNo}</>}
        </>
      }
      title={
        <span ref={headingRef} tabIndex={-1} style={{ outline: 'none' }}>
          {title}
        </span>
      }
      description={
        !formHint
          ? undefined
          : published
            ? '* 표시는 필수 항목이에요. 광고 중인 매물이라 단계를 옮길 때마다 저장되고, 공개 화면에 바로 반영돼요.'
            : '* 표시는 필수 항목이에요. 단계를 옮길 때마다 자동으로 저장돼요.'
      }
      actions={
        <>
          {listing && (
            <span className={styles.hdPill}>
              <StatusPill tone={STATUS_TONE[listing.status]}>
                {LISTING_STATUS_LABEL[listing.status]}
              </StatusPill>
            </span>
          )}
          <Button
            href={AGENT_ROUTES.listings}
            linkAs={Link}
            variant="secondary"
            iconLeft={<Icon name="list" size={18} />}
          >
            매물 목록
          </Button>
        </>
      }
    />
  );

  if (editing && query.isError) {
    const notFound = query.error instanceof ApiError && query.error.isNotFound;
    return (
      <ConsolePage width="wide">
        {header('매물 수정')}
        <div className={styles.gate}>
          {notFound ? (
            <EmptyState
              icon="building"
              title="매물을 찾을 수 없어요"
              description="삭제됐거나 우리 사무소가 관리하지 않는 매물이에요."
              action={
                <Button href={AGENT_ROUTES.listings} linkAs={Link}>
                  매물 목록으로
                </Button>
              }
            />
          ) : (
            <ErrorState
              description={errorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          )}
        </div>
      </ConsolePage>
    );
  }

  if (editing && !listing) {
    return (
      <ConsolePage width="wide">
        {header('매물 정보를 불러오고 있어요')}
        <div className={styles.form} role="status" aria-label="매물 정보를 불러오는 중">
          <div className={styles.skeleton}>
            <Skeleton height={56} radius={12} />
            <Skeleton width={200} height={26} />
            <Skeleton height={88} radius={16} />
            <Skeleton height={48} radius={12} />
            <Skeleton height={48} radius={12} width="60%" />
          </div>
        </div>
      </ConsolePage>
    );
  }

  if (listing && (!listing.isPrimary || listing.status === ListingStatus.CLOSED)) {
    return (
      <ConsolePage width="wide">
        {header(listing.isPrimary ? '거래완료된 매물이에요' : '공동중개로 참여 중인 매물이에요')}
        <div className={styles.gate}>
          <EmptyState
            icon="lock"
            title={
              listing.isPrimary
                ? '거래완료된 매물은 수정할 수 없어요'
                : '매물 정보는 최초 등록 사무소만 수정할 수 있어요'
            }
            description={
              listing.isPrimary
                ? '같은 집을 다시 광고하려면 새 매물로 등록해 주세요.'
                : `${listing.agencies.find((a) => a.isPrimary)?.name ?? '최초 등록 사무소'}에서 관리하는 매물이에요. 우리 사무소는 공동중개 사무소로 함께 표시돼요.`
            }
            action={
              <>
                <Button href={AGENT_ROUTES.listings} linkAs={Link} variant="secondary">
                  매물 목록으로
                </Button>
                {listing.status !== ListingStatus.CLOSED && (
                  <Button
                    href={ROUTES.listing(listing.id)}
                    linkAs={Link}
                    iconRight={<Icon name="external-link" size={18} />}
                  >
                    공개 페이지 보기
                  </Button>
                )}
              </>
            }
          />
        </div>
      </ConsolePage>
    );
  }

  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === LAST_STEP;
  const primaryLabel = !isLast ? '다음 단계로' : published ? '변경 내용 저장' : '광고 게시하기';

  return (
    <ConsolePage width="wide">
      {header(current.title, true)}
      <WizardContext.Provider value={ctx}>
        <FormProvider {...form}>
          <div className={cx(styles.layout, isLast && styles.full)}>
            <form
              className={styles.form}
              onSubmit={onSubmit}
              noValidate
              aria-label="매물 정보 입력"
            >
              <div className={styles.formHd}>
                <ol className={styles.stepper} aria-label="매물 등록 단계">
                  {STEPS.map((s, i) => {
                    const done = i < step;
                    const on = i === step;
                    const reachable = i <= maxReached && !busy;
                    const body = (
                      <>
                        <span className={styles.spC}>
                          {done ? <Icon name="check" size={18} /> : i + 1}
                        </span>
                        <span className={styles.spT}>{s.label}</span>
                      </>
                    );
                    return (
                      <li
                        key={s.key}
                        className={cx(
                          done && styles.done,
                          on && styles.on,
                          errorSteps.has(i) && styles.warnDot,
                        )}
                        aria-current={on ? 'step' : undefined}
                      >
                        {reachable && !on ? (
                          <button
                            type="button"
                            className={styles.stepBtn}
                            onClick={() => void goTo(i)}
                            aria-label={`${i + 1}단계 ${s.label}${errorSteps.has(i) ? ' (확인 필요)' : ''}로 이동`}
                          >
                            {body}
                          </button>
                        ) : (
                          <span className={styles.stepBtn}>{body}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <p className={styles.stepNow}>
                  <em>
                    {step + 1} / {STEPS.length}
                  </em>
                  {current.label}
                </p>
              </div>

              {alert && (
                <Callout
                  className={styles.alert}
                  tone="danger"
                  icon="alert"
                  live
                  title={alert.title}
                >
                  <div>
                    빨간색으로 표시된 칸을 채운 뒤 다시 시도해 주세요.
                    {alert.items.length > 0 && (
                      <ul className={styles.alertList}>
                        {alert.items.map(({ label, field }) => (
                          <li key={label}>
                            {field ? (
                              <button
                                type="button"
                                className={styles.missingBtn}
                                onClick={() => void goTo(FIELD_STEP[field], field)}
                              >
                                {label}
                                <Icon name="chevron-right" size={14} />
                              </button>
                            ) : (
                              <span className={cx(styles.missingBtn, styles.missingStatic)}>
                                {label}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Callout>
              )}

              {step === 0 && <StepProperty />}
              {step === 1 && <StepDeal />}
              {step === 2 && <StepDetail />}
              {step === 3 && <StepPhotos />}
              {step === 4 && <StepDescription />}
              {step === 5 && <StepVerify />}
              {step === 6 && <StepPreview />}

              <div className={styles.formFt}>
                {step === 0 ? (
                  <Button
                    href={AGENT_ROUTES.listings}
                    linkAs={Link}
                    variant="secondary"
                    size="lg"
                    iconLeft={
                      <span className={styles.ftIc}>
                        <Icon name="chevron-left" size={20} />
                      </span>
                    }
                  >
                    취소
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={busy}
                    onClick={() => void goTo(step - 1)}
                    iconLeft={
                      <span className={styles.ftIc}>
                        <Icon name="chevron-left" size={20} />
                      </span>
                    }
                  >
                    이전
                  </Button>
                )}
                <span className={styles.saved} role="status">
                  {saving ? (
                    '저장하는 중…'
                  ) : savedAt ? (
                    <>
                      <Icon name="check" size={16} />
                      {timeText(savedAt)} 저장됨
                    </>
                  ) : null}
                </span>
                {!published && (
                  <Button
                    variant="ghost"
                    size="lg"
                    disabled={busy}
                    onClick={() => void saveDraftNow()}
                  >
                    임시저장
                  </Button>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className={styles.next}
                  loading={busy}
                  iconRight={<Icon name={isLast ? 'check' : 'arrow-right'} size={20} />}
                >
                  {primaryLabel}
                </Button>
              </div>
            </form>

            {!isLast && (
              <aside className={styles.aside} aria-label="게시 준비 상태">
                <Checklist />
                <div className={styles.tip}>
                  <b>
                    <Icon name="users" size={18} />
                    같은 집을 다른 사무소가 올렸다면
                  </b>
                  새로 등록하지 말고 공동중개로 참여해 주세요. 방문자에게는 한 매물로 보이고, 우리
                  사무소가 중개사무소 목록에 함께 표시돼요.
                  <Link
                    className={styles.textBtn}
                    href={`${AGENT_ROUTES.listings}/co-broker`}
                    style={{ color: 'var(--accent)', paddingLeft: 0 }}
                  >
                    공동중개 매물 찾기
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </div>
              </aside>
            )}
          </div>
        </FormProvider>
      </WizardContext.Provider>

      <Modal
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title="저장하지 않은 내용이 있어요"
        description={
          published
            ? '지금 나가면 이 단계에서 고친 내용이 사라져요. 저장하면 공개 화면에도 바로 반영돼요.'
            : '지금 나가면 이 단계에서 입력한 내용이 사라져요. 저장하면 매물 관리의 ‘작성중’에서 이어서 쓸 수 있어요.'
        }
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => void leave(false)}>
              저장하지 않고 나가기
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => setLeaveTo(null)}>
              계속 작성
            </Button>
            <Button loading={saving} onClick={() => void leave(true)}>
              저장하고 나가기
            </Button>
          </>
        }
      />
    </ConsolePage>
  );
}
