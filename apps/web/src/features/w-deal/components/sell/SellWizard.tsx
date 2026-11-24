'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { DealRequestVisibility, MediaErrorCode } from '@house/shared';
import { FieldError, FormSection, useToast } from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { ROUTES } from '@/config/nav';
import {
  ApiError,
  CONSENT_OUTDATED_MESSAGE,
  errorMessage,
  isConsentOutdatedError,
  shownConsents,
} from '@/lib/api';
import { useActionTerms } from '@/lib/api/useActionTerms';
import { dealApi, dealKeys, type DealRequestCreatePayload } from '../../api/client';
import type { PickedAddress } from '../../lib/daum-postcode';
import { dealTypesFor } from '../../lib/labels';
import {
  isComplexAsset,
  SELL_DEFAULTS,
  SELL_STEP_FIELDS,
  SELL_STEPS,
  sellFormSchema,
  toSellPayload,
  type SellFormValues,
} from '../../lib/sell-form';
import { serviceRegionCodesOf } from '../../lib/service-area';
import {
  ConsentFields,
  ContactFields,
  recipientsText,
  ScopeFields,
  type ContactScopeSetter,
} from '../form/ContactScopeFields';
import { focusFirstError, setField, useWizard, type WizardUser } from '../form/useWizard';
import { WizardShell } from '../form/WizardShell';
import { ReachCard, useReach } from '../ReachCard';
import { SellReview } from './SellReview';
import { StepPhotos, StepProperty, StepTerms } from './SellSteps';
import { SellSummary } from './SellSummary';
import type { SellStepProps } from './types';

const TITLES = [
  '매물 정보를 알려주세요',
  '거래 조건을 알려주세요',
  '사진과 연락처를 남겨주세요',
  '입력한 내용을 확인해 주세요',
];

/** Drafts saved before 매매 was preselected may hold an empty / no longer allowed deal type. */
function normalizeSell(values: SellFormValues): SellFormValues {
  const allowed = dealTypesFor(values.assetType);
  return allowed.includes(values.dealType)
    ? values
    : { ...values, dealType: allowed[0] ?? SELL_DEFAULTS.dealType };
}

/** Media errors the create endpoint may answer for `photoMediaIds` (MEDIA_NOT_READY is assumed). */
const PHOTO_ERROR_CODES: readonly string[] = [MediaErrorCode.MEDIA_NOT_FOUND, 'MEDIA_NOT_READY'];
const PHOTO_STEP = SELL_STEP_FIELDS.findIndex((f) => f.includes('photos'));
/** Step with the 개인정보 consents (back to it when a consent document changed). */
const CONSENT_STEP = SELL_STEP_FIELDS.findIndex((f) => f.includes('agreePrivacy'));

/** 내놓기 wizard: 매물 정보 → 거래 조건 → 사진·연락처 → 확인·전달. */
export function SellWizard({ user }: { user: WizardUser }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<SellFormValues>({
    defaultValues: SELL_DEFAULTS,
    resolver: zodResolver(sellFormSchema),
    mode: 'onTouched',
  });
  const wizard = useWizard({
    kind: 'sell',
    user,
    form,
    defaults: SELL_DEFAULTS,
    stepFields: SELL_STEP_FIELDS,
    normalize: normalizeSell,
  });
  const v = form.watch();
  const [uploading, setUploading] = useState(false);
  const { errors } = form.formState;
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const err: SellStepProps['err'] = (name) =>
    (errors[name] as { message?: string } | undefined)?.message;
  // Choice controls validate at once; text fields only clear an existing error while typing.
  const set: SellStepProps['set'] = (key, value) =>
    setField(form, key, value, typeof value !== 'string' || !!errors[key]);
  const touch: SellStepProps['touch'] = (key) => void form.trigger(key);
  const setContact = set as unknown as ContactScopeSetter;

  // Address → complex (단지 확인됨), 법정동 and market hints.
  const match = useQuery({
    queryKey: dealKeys.addressMatch(v.roadAddress),
    queryFn: ({ signal }) =>
      dealApi.addressMatch(
        {
          roadAddress: v.roadAddress,
          buildingName: v.buildingName || undefined,
          bcode: v.bcode || undefined,
        },
        signal,
      ),
    enabled: wizard.ready && v.roadAddress.trim() !== '',
    staleTime: 10 * 60_000,
  });
  const matched =
    isComplexAsset(v.assetType) && dismissedFor !== v.roadAddress
      ? (match.data?.complex ?? null)
      : null;
  const matchedId = matched?.id ?? '';
  const matchedName = matched?.name ?? '';
  const matchedEmd = match.data?.emdCode ?? '';
  const { setValue, getValues } = form;
  useEffect(() => {
    if (!wizard.ready || match.isPending) return;
    if (getValues('complexId') !== matchedId) {
      setValue('complexId', matchedId, { shouldDirty: true });
      setValue('complexName', matchedName, { shouldDirty: true });
      if (!matchedId) {
        setValue('areaTypeId', '');
        setValue('areaTypeSqm', '');
        setValue('areaTypeLabel', '');
      }
    }
    if (matchedEmd && !getValues('bcode')) setValue('bcode', matchedEmd);
  }, [wizard.ready, match.isPending, matchedId, matchedName, matchedEmd, setValue, getValues]);

  const regionCodes = serviceRegionCodesOf(v.bcode);
  const reach = useReach(regionCodes);
  const selected = v.visibility === DealRequestVisibility.SELECTED_AGENCIES;

  const onAddress = (address: PickedAddress) => {
    setDismissedFor(null);
    set('roadAddress', address.roadAddress);
    set('jibunAddress', address.jibunAddress);
    set('zonecode', address.zonecode);
    set('bcode', address.bcode);
    set('buildingName', address.buildingName);
    set('areaTypeId', '');
    set('areaTypeSqm', '');
    set('areaTypeLabel', '');
    form.clearErrors('roadAddress');
  };

  const terms = useActionTerms('DEAL_REQUEST');
  const create = useMutation({
    mutationFn: (payload: DealRequestCreatePayload) =>
      dealApi.create(payload, shownConsents(terms.data)),
    onSuccess: (created) => {
      wizard.finish();
      void queryClient.invalidateQueries({ queryKey: dealKeys.all });
      router.replace(`${ROUTES.dealSell}/complete?id=${encodeURIComponent(created.id)}`);
    },
    onError: (e) => {
      if (isConsentOutdatedError(e)) {
        // A consent document changed since the user read it: show the new text, ask again.
        setContact('agreePrivacy', false);
        setContact('agreeProvide', false);
        void terms.refetch();
        form.setError('agreePrivacy', { type: 'server', message: CONSENT_OUTDATED_MESSAGE });
        wizard.goTo(CONSENT_STEP);
        return;
      }
      if (e instanceof ApiError && PHOTO_ERROR_CODES.includes(e.code)) {
        // A photo was deleted or is still being processed: back to the photo step.
        form.setError('photos', {
          type: 'server',
          message:
            e.code === 'MEDIA_NOT_READY'
              ? '사진을 아직 처리하고 있어요. 잠시 후 다시 등록해 주세요.'
              : '올린 사진 중 일부를 찾을 수 없어요. 사진을 확인하고 다시 올려 주세요.',
        });
        wizard.goTo(PHOTO_STEP);
        return;
      }
      if (e instanceof ApiError && e.isValidation) {
        // Paths may be nested ("photoMediaIds.2") — map them by their first segment.
        const known = new Map<keyof SellFormValues, string>();
        for (const [path, message] of Object.entries(e.fieldErrors())) {
          const name = SERVER_FIELD_MAP[path.split('.')[0] ?? ''];
          if (name && !known.has(name)) known.set(name, message);
        }
        known.forEach((message, name) => form.setError(name, { type: 'server', message }));
        const first = known.keys().next().value;
        if (first !== undefined) {
          const step = SELL_STEP_FIELDS.findIndex((f) => f.includes(first));
          if (step >= 0) wizard.goTo(step);
          return;
        }
      }
      setSubmitError(errorMessage(e));
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    if (uploading) return; // the footer button is disabled meanwhile; Enter in a field lands here
    if (wizard.step < wizard.lastStep) {
      await wizard.next();
      return;
    }
    if (create.isPending) return;
    const ok = await form.trigger();
    if (!ok) {
      const bad = SELL_STEP_FIELDS.findIndex((fields) =>
        fields.some((f) => form.getFieldState(f).invalid),
      );
      if (bad >= 0) wizard.goTo(bad);
      requestAnimationFrame(() => focusFirstError(wizard.formRef.current));
      return;
    }
    create.mutate(toSellPayload(form.getValues(), { floorsMax: matched?.floorsMax }));
  };

  const stepProps: SellStepProps = { form, v, err, set, touch, complex: matched };

  return (
    <WizardShell
      eyebrow="내 집 내놓기"
      title={TITLES[wizard.step] ?? TITLES[0] ?? ''}
      crumb="내놓기"
      steps={SELL_STEPS}
      stepperLabel="내놓기 진행 단계"
      wizard={wizard}
      user={user}
      submitLabel="요청 등록하기"
      submitting={create.isPending || create.isSuccess}
      blocked={uploading ? '사진을 올리는 중이에요…' : undefined}
      onSubmit={(e) => void onSubmit(e)}
      notice={
        <>
          요청을 등록하면 {selected ? '선택한' : '매물 근처'} 중개사무소에 바로 전달돼요. 30일 동안
          제안을 받을 수 있고, <b>내 요청 관리</b>에서 언제든 중단할 수 있어요.
        </>
      }
      error={submitError && <FieldError>{submitError}</FieldError>}
      aside={
        <>
          <SellSummary v={v} step={wizard.step} steps={SELL_STEPS.length} />
          <ReachCard
            kind="sell"
            regionCodes={regionCodes}
            selected={selected ? v.targetAgencies : null}
          />
        </>
      }
    >
      {wizard.step === 0 && (
        <StepProperty
          {...stepProps}
          matching={match.isFetching && isComplexAsset(v.assetType)}
          onDismissComplex={() => setDismissedFor(v.roadAddress)}
          onAddress={onAddress}
        />
      )}
      {wizard.step === 1 && <StepTerms {...stepProps} />}
      {wizard.step === 2 && (
        <>
          <FormSection letter="C" title="사진 · 연락처">
            <StepPhotos v={v} err={err} set={set} onBusyChange={setUploading} />
            <ContactFields
              idPrefix="sell"
              values={v}
              errors={contactErrors(err)}
              set={setContact}
              touch={touch}
            />
          </FormSection>
          <FormSection letter="D" title="전달 범위 · 동의">
            <ScopeFields
              idPrefix="sell"
              values={v}
              errors={contactErrors(err)}
              set={setContact}
              reachTotal={reach.data?.total}
              areaLabel={reach.data?.areaLabel}
              regionCodes={regionCodes}
              nearLabel="매물 근처"
            />
            <ConsentFields
              idPrefix="sell"
              values={v}
              errors={contactErrors(err)}
              set={setContact}
              terms={terms}
              recipients={recipientsText({
                values: v,
                nearLabel: '매물 근처',
                areaLabel: reach.data?.areaLabel,
                reachTotal: reach.data?.total,
              })}
            />
          </FormSection>
        </>
      )}
      {wizard.step === 3 && <SellReview v={v} reachTotal={reach.data?.total} goTo={wizard.goTo} />}
    </WizardShell>
  );
}

function contactErrors(err: SellStepProps['err']) {
  return {
    contactName: err('contactName'),
    contactPhone: err('contactPhone'),
    targetAgencies: err('targetAgencies'),
    agreePrivacy: err('agreePrivacy'),
    agreeProvide: err('agreeProvide'),
  };
}

/** API field path (first segment) → form field, for server-side validation errors. */
const SERVER_FIELD_MAP: Partial<Record<string, keyof SellFormValues>> = {
  assetType: 'assetType',
  roadAddress: 'roadAddress',
  addressDetail: 'addressDetail',
  dealTypes: 'dealType',
  desiredSalePrice: 'salePrice',
  desiredDeposit: 'deposit',
  desiredMonthlyRent: 'monthlyRent',
  exclusiveArea: 'area',
  floor: 'floor',
  moveInDate: 'moveInDate',
  description: 'description',
  contactName: 'contactName',
  contactPhone: 'contactPhone',
  targetAgencyIds: 'targetAgencies',
  photoMediaIds: 'photos',
};
