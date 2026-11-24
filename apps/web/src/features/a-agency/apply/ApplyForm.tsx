'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AgenciesErrorCode, type AgencyDocumentType } from '@house/shared';
import {
  Button,
  Callout,
  Checkbox,
  Icon,
  Input,
  Panel,
  Stepper,
  Textarea,
  useToast,
} from '@house/ui';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import {
  ApiError,
  CONSENT_OUTDATED_MESSAGE,
  errorMessage,
  isConsentOutdatedError,
  shownConsents,
} from '@/lib/api';
import { useActionTerms } from '@/lib/api/useActionTerms';
import { agencyKeys, registerAgency, resubmitAgency } from '../api/queries';
import {
  applyFormSchema,
  type ApplyFormInput,
  type ApplyFormValues,
  type MyAgency,
} from '../api/schemas';
import {
  APPLICATION_STEPS,
  EMPTY_APPLY_FORM,
  applyFormFromAgency,
  latestDocuments,
  missingDocuments,
  toRegisterPayload,
  toResubmitPayload,
} from '../lib/application';
import {
  REGISTRATION_NUMBER_EXAMPLE,
  formatBusinessNumber,
  normalizeRegistrationNumber,
} from '../lib/registration';
import { AGENT_ROUTES } from '../nav';
import { PrivacySummary } from '../ui/PrivacySummary';
import { SpecialtyPicker } from '../ui/SpecialtyPicker';
import { AddressField } from './AddressField';
import styles from './Apply.module.css';
import { DocumentSlots } from './DocumentSlots';
import { LocationPicker } from './LocationPicker';
import { useDocumentUploads } from './useDocumentUploads';

export interface ApplyFormProps {
  /** Rejected application to correct and resubmit; omit for a new application. */
  agency?: MyAgency;
  onCancel?: () => void;
  /** Called after a successful submit (the status view takes over). */
  onSubmitted?: () => void;
}

function SectionTitle({ step, children }: { step: number; children: string }) {
  return (
    <span className={styles.secTitle}>
      <span className={styles.secNo} aria-hidden="true">
        {step}
      </span>
      {children}
    </span>
  );
}

/** Fields in visual order — the first invalid one gets focus (not react-hook-form's register order). */
const FIELD_ORDER: readonly (keyof ApplyFormInput)[] = [
  'name',
  'representativeName',
  'registrationNumber',
  'businessNumber',
  'phone',
  'mobile',
  'roadAddress',
  'addressDetail',
  'lat',
  'lng',
  'intro',
  'agreeTruth',
  'agreePrivacy',
];

/** Agency registration application (new) or corrected resubmission (after a rejection). */
export function ApplyForm({ agency, onCancel, onSubmitted }: ApplyFormProps) {
  const resubmit = !!agency;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mapHintId = useId();
  const docsHeadingId = useId();
  const privacyId = useId();
  const terms = useActionTerms('AGENCY_APPLICATION');
  const pickerRef = useRef<HTMLDivElement>(null);

  const form = useForm<ApplyFormInput, unknown, ApplyFormValues>({
    resolver: zodResolver(applyFormSchema),
    mode: 'onBlur',
    // Focus is moved by focusFirstError() in visual order (the hoisted register() calls below would
    // otherwise make 등록번호 the first field react-hook-form focuses).
    shouldFocusError: false,
    defaultValues: agency ? applyFormFromAgency(agency) : EMPTY_APPLY_FORM,
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const existingDocs = agency ? latestDocuments(agency.documents) : {};
  const uploads = useDocumentUploads();
  const [missingDocs, setMissingDocs] = useState<AgencyDocumentType[]>([]);

  const lat = watch('lat');
  const lng = watch('lng');
  const jibun = watch('jibunAddress');
  const intro = watch('intro') ?? '';
  const position = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;

  /** Focus the first invalid field in visual order; the map for a missing / out-of-area pin. */
  const focusFirstError = (fieldErrors: FieldErrors<ApplyFormInput>) => {
    const first = FIELD_ORDER.find((key) => fieldErrors[key]);
    if (!first) return;
    if (first === 'lat' || first === 'lng') {
      const map = pickerRef.current;
      const target = map?.querySelector<HTMLElement>('[tabindex="0"]') ?? map;
      target?.focus();
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFocus(first);
  };

  const presentDocTypes = (): AgencyDocumentType[] => [
    ...(Object.keys(existingDocs) as AgencyDocumentType[]),
    ...uploads.ready.map((d) => d.type),
  ];

  const onValid = async (values: ApplyFormValues) => {
    if (uploads.uploading) {
      toast({ message: '서류 업로드가 끝난 뒤에 제출해 주세요.', tone: 'info' });
      return;
    }
    const missing = missingDocuments(presentDocTypes());
    setMissingDocs(missing);
    if (missing.length > 0) {
      document
        .getElementById(docsHeadingId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast({ message: '필수 서류를 올려 주세요.', tone: 'error' });
      return;
    }
    try {
      // The uploaded documents travel with the application (the server requires the 등록증 in
      // POST /agencies); on a resubmit they are added next to the ones already attached.
      const saved = resubmit
        ? await resubmitAgency(toResubmitPayload(values, uploads.ready))
        : await registerAgency(
            toRegisterPayload(values, uploads.ready),
            shownConsents(terms.data),
          );
      queryClient.setQueryData(agencyKeys.mine, saved);
      await queryClient.invalidateQueries({ queryKey: agencyKeys.mine });
      toast({
        message: resubmit ? '다시 신청했어요. 심사 결과를 알려 드릴게요.' : '신청이 접수되었어요.',
      });
      onSubmitted?.();
      router.refresh();
      window.scrollTo({ top: 0 });
    } catch (error) {
      if (!resubmit && isConsentOutdatedError(error)) {
        // The notice changed since it was loaded: show the new text and ask for a new agreement.
        setValue('agreePrivacy', false);
        void terms.refetch();
        setError('agreePrivacy', { type: 'server', message: CONSENT_OUTDATED_MESSAGE });
        focusFirstError({ agreePrivacy: { type: 'server', message: CONSENT_OUTDATED_MESSAGE } });
        return;
      }
      if (error instanceof ApiError) {
        const fields = error.fieldErrors();
        if (error.code === AgenciesErrorCode.AGENCY_REGISTRATION_DUPLICATE) {
          fields.registrationNumber ??= error.message;
        }
        const known = Object.entries(fields).filter(([key]) =>
          (FIELD_ORDER as readonly string[]).includes(key),
        );
        if (known.length > 0) {
          const serverErrors: FieldErrors<ApplyFormInput> = {};
          known.forEach(([key, message]) => {
            setError(key as keyof ApplyFormInput, { type: 'server', message });
            serverErrors[key as keyof ApplyFormInput] = { type: 'server', message };
          });
          focusFirstError(serverErrors);
          return;
        }
      }
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<ApplyFormInput>) => {
    toast({ message: '입력 내용을 확인해 주세요.', tone: 'error' });
    setMissingDocs(missingDocuments(presentDocTypes()));
    focusFirstError(fieldErrors);
  };

  const registration = register('registrationNumber');
  const business = register('businessNumber');

  return (
    <form
      className={styles.layout}
      onSubmit={(e) => void handleSubmit(onValid, onInvalid)(e)}
      noValidate
    >
      <div className={styles.formCol}>
        {resubmit && agency?.statusReason && (
          <Callout tone="danger" title="반려 사유">
            {agency.statusReason}
          </Callout>
        )}

        <Panel
          title={<SectionTitle step={1}>사무소 정보</SectionTitle>}
          description="중개사무소 등록증에 적힌 내용 그대로 입력해 주세요"
        >
          <div className={styles.grid2}>
            <Input
              label="상호"
              required
              placeholder="예: 신대중앙 공인중개사사무소"
              autoComplete="organization"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="대표 공인중개사 성명"
              required
              placeholder="등록증의 대표자 성명"
              autoComplete="name"
              error={errors.representativeName?.message}
              {...register('representativeName')}
            />
            <Input
              label="중개사무소 등록번호"
              required
              placeholder={REGISTRATION_NUMBER_EXAMPLE}
              help="등록증 상단의 등록번호예요. 국가공간정보 중개업 조회와 대조해요."
              autoComplete="off"
              error={errors.registrationNumber?.message}
              {...registration}
              onBlur={(e) => {
                setValue('registrationNumber', normalizeRegistrationNumber(e.target.value));
                void registration.onBlur(e);
              }}
            />
            <Input
              label="사업자등록번호"
              required
              placeholder="000-00-00000"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              error={errors.businessNumber?.message}
              {...business}
              onChange={(e) => {
                e.target.value = formatBusinessNumber(e.target.value);
                void business.onChange(e);
              }}
            />
            <Input
              label="대표 전화번호"
              required
              placeholder="061-000-0000"
              inputMode="tel"
              autoComplete="tel"
              help="매물과 사무소 페이지에 공개되는 번호예요."
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="휴대폰 번호 (선택)"
              placeholder="010-0000-0000"
              inputMode="tel"
              autoComplete="tel"
              help="심사 안내 연락에만 써요. 인증 문자는 보내지 않아요."
              error={errors.mobile?.message}
              {...register('mobile')}
            />
          </div>
        </Panel>

        <Panel
          title={<SectionTitle step={2}>사무소 위치</SectionTitle>}
          description="주소를 검색한 뒤 지도의 핀이 사무소 입구에 오도록 맞춰 주세요"
        >
          <div className={styles.stack}>
            <div className={styles.grid2}>
              <Controller
                control={control}
                name="roadAddress"
                render={({ field }) => (
                  <AddressField
                    value={field.value ?? ''}
                    inputRef={field.ref}
                    error={errors.roadAddress?.message}
                    onSelect={(item) => {
                      field.onChange(item.roadAddress);
                      setValue('jibunAddress', item.jibunAddress ?? '');
                      setValue('lat', item.lat, { shouldValidate: true });
                      setValue('lng', item.lng, { shouldValidate: true });
                      form.clearErrors('roadAddress');
                    }}
                    onClear={() => {
                      field.onChange('');
                      setValue('jibunAddress', '');
                      // A stale pin must not be combined with a later, different address.
                      form.resetField('lat', { defaultValue: undefined });
                      form.resetField('lng', { defaultValue: undefined });
                    }}
                  />
                )}
              />
              <Input
                label="상세 주소 (선택)"
                placeholder="예: 105호, 상가 B동 1층"
                autoComplete="address-line2"
                error={errors.addressDetail?.message}
                {...register('addressDetail')}
              />
            </div>
            {jibun && <p className={styles.jibun}>지번 {jibun}</p>}
            <LocationPicker
              ref={pickerRef}
              value={position}
              invalid={!!errors.lat || !!errors.lng}
              describedBy={mapHintId}
              onChange={(p) => {
                setValue('lat', p.lat, { shouldValidate: true, shouldDirty: true });
                setValue('lng', p.lng, { shouldValidate: true, shouldDirty: true });
              }}
            />
            <p
              id={mapHintId}
              className={errors.lat || errors.lng ? styles.fieldError : styles.fieldHelp}
              role={errors.lat || errors.lng ? 'alert' : undefined}
            >
              {errors.lat?.message ??
                errors.lng?.message ??
                (position
                  ? '지도에 표시된 위치가 사무소 페이지와 중개사무소 찾기 지도에 쓰여요.'
                  : '아직 위치가 지정되지 않았어요.')}
            </p>
          </div>
        </Panel>

        <Panel
          title={
            <span id={docsHeadingId} className={styles.anchor}>
              <SectionTitle step={3}>증빙 서류</SectionTitle>
            </span>
          }
          description="심사에만 쓰이며 다른 사람에게 공개되지 않아요"
        >
          <div className={styles.stack}>
            <DocumentSlots
              existing={existingDocs}
              pending={uploads.docs}
              onPick={(type, file) => {
                setMissingDocs((m) => m.filter((t) => t !== type));
                void uploads.pick(type, file);
              }}
              onRemove={uploads.remove}
              missing={missingDocs}
            />
            <Callout tone="info">
              주민등록번호 뒷자리 등 필요 없는 개인정보는 가리고 올려 주세요. 서류는 암호화된 비공개
              저장소에 보관하고, 담당자만 열람할 수 있어요.
            </Callout>
          </div>
        </Panel>

        <Panel
          title={<SectionTitle step={4}>전문 분야 · 소개 (선택)</SectionTitle>}
          description="승인 뒤 사무소 프로필에서 언제든 바꿀 수 있어요"
        >
          <div className={styles.stack}>
            <div>
              <p className={styles.label}>전문 분야</p>
              <Controller
                control={control}
                name="specialties"
                render={({ field }) => (
                  <SpecialtyPicker value={field.value ?? []} onChange={field.onChange} />
                )}
              />
            </div>
            <Textarea
              label="사무소 소개"
              rows={4}
              maxLength={3000}
              placeholder="예: 신대지구 입주 때부터 레이크파크 단지만 중개하고 있어요."
              help={`${intro.length.toLocaleString('ko-KR')} / 3,000자`}
              error={errors.intro?.message}
              {...register('intro')}
            />
          </div>
        </Panel>

        <div className={styles.submit}>
          <Checkbox aria-invalid={errors.agreeTruth ? true : undefined} {...register('agreeTruth')}>
            <span>
              <b>[필수]</b> 입력한 내용과 제출 서류가 사실과 같습니다.
            </span>
          </Checkbox>
          {errors.agreeTruth && (
            <p className={styles.fieldError} role="alert">
              {errors.agreeTruth.message}
            </p>
          )}
          <div className={styles.consent}>
            <Checkbox
              aria-invalid={errors.agreePrivacy ? true : undefined}
              aria-describedby={privacyId}
              {...register('agreePrivacy')}
            >
              <span>
                <b>[필수]</b> 개인정보 수집·이용에 동의합니다.
              </span>
            </Checkbox>
            <PrivacySummary id={privacyId} terms={terms} />
          </div>
          {errors.agreePrivacy && (
            <p className={styles.fieldError} role="alert">
              {errors.agreePrivacy.message}
            </p>
          )}
          <div className={styles.submitRow}>
            {onCancel && (
              <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
                취소
              </Button>
            )}
            <Button type="submit" size="lg" loading={isSubmitting} disabled={uploads.uploading}>
              {resubmit ? '수정해서 다시 신청' : '신청서 제출'}
            </Button>
          </div>
        </div>
      </div>

      <aside className={styles.aside} aria-label="신청 안내">
        <Panel title="신청 절차">
          <Stepper
            label="중개사 회원 신청 절차"
            orientation="vertical"
            current={0}
            steps={APPLICATION_STEPS.map((s) => ({ label: s.label, description: s.description }))}
          />
        </Panel>
        <Panel title="미리 준비해 주세요">
          <ul className={styles.checklist}>
            <li>
              <Icon name="check" size={16} strokeWidth={2.5} />
              중개사무소 등록증 (사진 또는 PDF)
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.5} />
              사업자등록증 (사진 또는 PDF)
            </li>
            <li>
              <Icon name="check" size={16} strokeWidth={2.5} />
              손해배상책임 보증서류 — 공제증서·보증보험증권 (권장)
            </li>
          </ul>
          <p className={styles.asideNote}>
            소속 공인중개사·중개보조원은 신청서 대신 대표님께 받은{' '}
            <Link href={AGENT_ROUTES.applyJoin} className="link">
              초대 코드
            </Link>
            로 합류해 주세요.
          </p>
        </Panel>
      </aside>
    </form>
  );
}
