'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AgencyMemberRole, AgencyStatus, MediaPurpose } from '@house/shared';
import {
  Button,
  Callout,
  ErrorState,
  Icon,
  Input,
  LoadingRegion,
  Panel,
  Skeleton,
  Spinner,
  Textarea,
  cx,
  useToast,
} from '@house/ui';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ROUTES } from '@/config/nav';
import { ApiError, errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { agencyKeys, updateMyAgency, uploadMedia } from '../api/queries';
import {
  profileFormSchema,
  type Media,
  type MyAgency,
  type ProfileFormValues,
} from '../api/schemas';
import { useMyAgency } from '../api/useMyAgency';
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, validateUpload } from '../lib/application';
import {
  DAY_KEYS,
  DEFAULT_BUSINESS_HOURS,
  invalidDays,
  normalizeBusinessHours,
  sameBusinessHours,
} from '../lib/business-hours';
import { buildProfilePatch, unpersistedProfileFields } from '../lib/profile';
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard';
import { AGENT_ROUTES } from '../nav';
import { ConsolePage, ConsolePageHeader } from '../shell';
import { FileButton } from '../ui/FileButton';
import { SpecialtyPicker } from '../ui/SpecialtyPicker';
import { BusinessHoursEditor, type HoursDraft } from './BusinessHoursEditor';
import { MediaImage } from './MediaImage';
import styles from './Profile.module.css';
import { ProfilePreview } from './ProfilePreview';

function formDefaults(agency: MyAgency): ProfileFormValues {
  return {
    intro: agency.intro ?? '',
    specialties: agency.specialties,
    phone: formatPhone(agency.phone),
    mobile: agency.mobile ? formatPhone(agency.mobile) : '',
  };
}

function ProfileSkeleton() {
  return (
    <LoadingRegion label="사무소 프로필을 불러오는 중">
      <div className={styles.layout}>
        <div className={styles.formCol}>
          <Skeleton height={300} radius={16} />
          <Skeleton height={260} radius={16} />
          <Skeleton height={420} radius={16} />
        </div>
        <Skeleton height={520} radius={16} />
      </div>
    </LoadingRegion>
  );
}

interface ImageSlotState {
  uploading: boolean;
  error?: string;
}

type ImageSlot = 'logo' | 'cover';

/**
 * Object URLs of freshly picked images, shown until the uploaded media has variants (processing is
 * asynchronous). Revoked when replaced and on unmount.
 */
function useLocalPreviews() {
  const [previews, setPreviews] = useState<Partial<Record<ImageSlot, string>>>({});
  const live = useRef(previews);
  live.current = previews;
  useEffect(
    () => () => Object.values(live.current).forEach((url) => url && URL.revokeObjectURL(url)),
    [],
  );
  const set = (slot: ImageSlot, file: File | null) =>
    setPreviews((p) => {
      const old = p[slot];
      if (old) URL.revokeObjectURL(old);
      return { ...p, [slot]: file ? URL.createObjectURL(file) : undefined };
    });
  return [previews, set] as const;
}

function ProfileEditor({ agency }: { agency: MyAgency }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = agency.myRole === AgencyMemberRole.OWNER;
  const canEdit = isOwner && agency.status === AgencyStatus.APPROVED;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onBlur',
    defaultValues: formDefaults(agency),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = form;
  const live = useWatch({ control });

  const savedHours = useMemo(() => normalizeBusinessHours(agency.businessHours), [agency]);
  const [hours, setHours] = useState<HoursDraft>(savedHours);
  const [logo, setLogo] = useState<Media | null>(agency.logo ?? null);
  const [cover, setCover] = useState<Media | null>(agency.cover ?? null);
  const [slots, setSlots] = useState<{ logo: ImageSlotState; cover: ImageSlotState }>({
    logo: { uploading: false },
    cover: { uploading: false },
  });

  const [previews, setPreview] = useLocalPreviews();

  const hoursDirty = !sameBusinessHours(hours, savedHours);
  const logoDirty = (logo?.id ?? null) !== (agency.logo?.id ?? null);
  const coverDirty = (cover?.id ?? null) !== (agency.cover?.id ?? null);
  const dirty = isDirty || hoursDirty || logoDirty || coverDirty;
  const badDays = invalidDays(hours);
  const busy = slots.logo.uploading || slots.cover.uploading;

  // Reload / close → browser prompt; sidebar, tab bar and other in-app links → ConfirmDialog.
  const leaveGuard = useUnsavedChangesGuard(canEdit && dirty);

  const pickImage = async (slot: ImageSlot, file: File) => {
    const invalid = validateUpload(file, IMAGE_ACCEPT, IMAGE_MAX_BYTES);
    if (invalid) {
      setSlots((s) => ({ ...s, [slot]: { uploading: false, error: invalid } }));
      return;
    }
    setSlots((s) => ({ ...s, [slot]: { uploading: true } }));
    try {
      // The schema has no dedicated cover purpose yet → both use AGENCY_LOGO (see integration doc).
      const media = await uploadMedia(file, MediaPurpose.AGENCY_LOGO);
      setPreview(slot, file);
      if (slot === 'logo') setLogo(media);
      else setCover(media);
      setSlots((s) => ({ ...s, [slot]: { uploading: false } }));
    } catch (error) {
      setSlots((s) => ({ ...s, [slot]: { uploading: false, error: errorMessage(error) } }));
    }
  };

  const discard = () => {
    reset(formDefaults(agency));
    setHours(savedHours);
    setLogo(agency.logo ?? null);
    setCover(agency.cover ?? null);
    setSlots({ logo: { uploading: false }, cover: { uploading: false } });
  };

  const save = async (values: ProfileFormValues) => {
    if (badDays.length > 0) {
      toast({ message: '영업시간을 확인해 주세요.', tone: 'error' });
      return;
    }
    try {
      // Only what changed (no nulls for untouched fields); see lib/profile.ts.
      const patch = buildProfilePatch(agency, { values, hours, logo, cover });
      const saved = await updateMyAgency(patch);
      queryClient.setQueryData(agencyKeys.mine, saved);
      reset(formDefaults(saved));
      // An API that strips unknown keys answers 200 without them → keep the draft and say so.
      const lost = unpersistedProfileFields(patch, saved);
      if (lost.includes('소개')) form.setValue('intro', values.intro, { shouldDirty: true });
      if (lost.includes('휴대폰 번호'))
        form.setValue('mobile', values.mobile, { shouldDirty: true });
      if (!lost.includes('영업시간')) setHours(normalizeBusinessHours(saved.businessHours));
      if (!lost.includes('로고')) setLogo(saved.logo ?? null);
      if (!lost.includes('커버 사진')) setCover(saved.cover ?? null);
      toast(
        lost.length > 0
          ? {
              message: `${lost.join('·')}이(가) 저장되지 않았어요. 잠시 후 다시 저장해 주세요.`,
              tone: 'error',
              duration: 8000,
            }
          : { message: '프로필을 저장했어요.' },
      );
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const fields = error.fieldErrors();
        (['intro', 'phone', 'mobile'] as const).forEach((key) => {
          if (fields[key]) setError(key, { type: 'server', message: fields[key] });
        });
      }
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  const address = [agency.roadAddress, agency.addressDetail].filter(Boolean).join(', ');
  const introLength = (live.intro ?? '').length;

  return (
    <form
      className={styles.layout}
      onSubmit={(e) =>
        void handleSubmit(save, () =>
          toast({ message: '입력 내용을 확인해 주세요.', tone: 'error' }),
        )(e)
      }
      noValidate
    >
      <div className={styles.formCol}>
        {!canEdit && (
          <Callout tone="info">
            {agency.status !== AgencyStatus.APPROVED
              ? '승인된 사무소만 프로필을 수정할 수 있어요.'
              : '사무소 프로필은 대표 공인중개사만 수정할 수 있어요.'}
          </Callout>
        )}

        <Panel title="로고 · 커버 사진" description="JPG · PNG · WebP, 10MB 이하">
          <div className={styles.images}>
            <div className={styles.coverBox}>
              <div className={styles.cover}>
                {cover ? (
                  <MediaImage
                    media={cover}
                    alt="현재 커버 사진"
                    sizes="(max-width: 720px) 100vw, 760px"
                    variant="large"
                    previewUrl={previews.cover}
                  />
                ) : (
                  <span className={styles.coverEmpty}>
                    <Icon name="image" size={28} />
                    아직 커버 사진이 없어요
                  </span>
                )}
                {slots.cover.uploading && (
                  <span className={styles.imgBusy}>
                    <Spinner size={22} label="커버 사진 업로드 중" />
                  </span>
                )}
              </div>
              <div className={styles.imgMeta}>
                <div>
                  <p className={styles.imgTitle}>커버 사진</p>
                  <p className={styles.imgHint}>
                    가로로 긴 사무소 전경이나 간판 사진 · 권장 1600 × 500
                  </p>
                </div>
                {canEdit && (
                  <div className={styles.imgActions}>
                    <FileButton
                      label="커버 사진 선택"
                      accept={IMAGE_ACCEPT}
                      disabled={slots.cover.uploading}
                      onFile={(f) => void pickImage('cover', f)}
                    >
                      <Icon name="camera" size={16} />
                      {cover ? '변경' : '사진 올리기'}
                    </FileButton>
                    {cover && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCover(null)}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {slots.cover.error && (
                <p className={styles.error} role="alert">
                  {slots.cover.error}
                </p>
              )}
            </div>

            <div className={styles.logoBox}>
              <span className={cx(styles.logo, logo && styles.logoFilled)}>
                {logo ? (
                  // `medium` keeps the aspect ratio (thumb is a 4:3 cover crop that cuts wordmarks).
                  <MediaImage
                    media={logo}
                    alt="현재 로고"
                    sizes="88px"
                    variant="medium"
                    fit="contain"
                    previewUrl={previews.logo}
                  />
                ) : (
                  agency.name.slice(0, 2)
                )}
                {slots.logo.uploading && (
                  <span className={styles.imgBusy}>
                    <Spinner size={20} label="로고 업로드 중" />
                  </span>
                )}
              </span>
              <div className={styles.imgMeta}>
                <div>
                  <p className={styles.imgTitle}>로고</p>
                  <p className={styles.imgHint}>
                    정사각형 이미지 · 권장 400 × 400. 없으면 상호 앞 두 글자가 보여요.
                  </p>
                </div>
                {canEdit && (
                  <div className={styles.imgActions}>
                    <FileButton
                      label="로고 이미지 선택"
                      accept={IMAGE_ACCEPT}
                      disabled={slots.logo.uploading}
                      onFile={(f) => void pickImage('logo', f)}
                    >
                      <Icon name="upload" size={16} />
                      {logo ? '변경' : '로고 올리기'}
                    </FileButton>
                    {logo && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                        삭제
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {slots.logo.error && (
                <p className={styles.error} role="alert">
                  {slots.logo.error}
                </p>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="소개 · 전문 분야"
          description="중개사무소 찾기와 매물 상세의 사무소 카드에 보여요"
        >
          <div className={styles.stack}>
            <Textarea
              label="사무소 소개"
              rows={5}
              maxLength={3000}
              disabled={!canEdit}
              placeholder="어떤 지역·단지를 주로 중개하는지, 사무소의 강점을 2~3문장으로 적어 보세요."
              help={`${introLength.toLocaleString('ko-KR')} / 3,000자`}
              error={errors.intro?.message}
              {...register('intro')}
            />
            <div>
              <p className={styles.label}>전문 분야</p>
              <Controller
                control={control}
                name="specialties"
                render={({ field }) => (
                  <SpecialtyPicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!canEdit}
                  />
                )}
              />
              <p className={styles.help}>
                고객이 중개사무소 찾기에서 전문 분야로 걸러 볼 수 있어요.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="영업시간" description="‘영업 중’ 표시와 사무소 페이지에 쓰여요">
          <BusinessHoursEditor value={hours} onChange={setHours} disabled={!canEdit} />
          {canEdit && DAY_KEYS.every((d) => hours[d] === null) && (
            <p className={styles.help}>
              아직 영업시간이 없어요.{' '}
              <button
                type="button"
                className="link"
                onClick={() => setHours({ ...DEFAULT_BUSINESS_HOURS })}
              >
                기본 시간(평일 09–18시, 토 10–15시) 넣기
              </button>
            </p>
          )}
        </Panel>

        <Panel title="연락처 · 위치">
          <div className={styles.stack}>
            <div className={styles.grid2}>
              <Input
                label="대표 전화번호"
                required
                inputMode="tel"
                autoComplete="tel"
                disabled={!canEdit}
                help="매물과 사무소 페이지에 공개돼요."
                error={errors.phone?.message}
                {...register('phone')}
              />
              {/* Owner-only: the representative's private number is not shown to staff. */}
              {isOwner && (
                <Input
                  label="휴대폰 번호 (선택)"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={!canEdit}
                  help="공개되지 않고 운영 안내에만 써요."
                  error={errors.mobile?.message}
                  {...register('mobile')}
                />
              )}
            </div>
            <dl className={styles.locked}>
              <div>
                <dt>소재지</dt>
                <dd>{address}</dd>
              </div>
              <div>
                <dt>등록번호</dt>
                <dd>{agency.registrationNumber}</dd>
              </div>
            </dl>
            <p className={styles.help}>
              상호·소재지·대표자는 등록증 기준이라 여기서 바꿀 수 없어요.{' '}
              <Link href={AGENT_ROUTES.apply} className="link">
                등록 정보 보기
              </Link>
            </p>
          </div>
        </Panel>
      </div>

      <aside className={styles.aside} aria-label="공개 프로필 미리보기">
        <p className={styles.asideTitle}>
          <Icon name="eye" size={16} />
          고객에게 이렇게 보여요
        </p>
        <ProfilePreview
          name={agency.name}
          representativeName={agency.representativeName}
          registrationNumber={agency.registrationNumber}
          address={address}
          phone={live.phone ?? agency.phone}
          intro={(live.intro ?? '').trim()}
          specialties={live.specialties ?? agency.specialties}
          businessHours={badDays.length > 0 ? normalizeBusinessHours(agency.businessHours) : hours}
          logo={logo}
          cover={cover}
          logoPreview={previews.logo}
          coverPreview={previews.cover}
        />
        <Button
          variant="secondary"
          block
          href={ROUTES.agency(agency.id)}
          target="_blank"
          rel="noopener"
          iconRight={<Icon name="external-link" size={16} />}
        >
          공개 페이지 열기
        </Button>
        <p className={styles.asideHint}>저장한 내용만 공개 페이지에 반영돼요.</p>
      </aside>

      {canEdit && (
        <div className={styles.saveBar} data-dirty={dirty || undefined}>
          <p className={styles.saveText} role="status">
            {dirty ? '저장하지 않은 변경사항이 있어요' : '모든 변경사항이 저장되어 있어요'}
          </p>
          <div className={styles.saveActions}>
            <Button
              type="button"
              variant="ghost"
              onClick={discard}
              disabled={!dirty || isSubmitting}
            >
              되돌리기
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!dirty || busy}>
              변경사항 저장
            </Button>
          </div>
        </div>
      )}
      {leaveGuard}
    </form>
  );
}

/** /agent/profile — public profile editor (logo, cover, intro, specialties, hours) with live preview. */
export function ProfileView() {
  const { data: agency, isPending, isError, error, refetch } = useMyAgency();
  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow="사무소"
        title="사무소 프로필"
        description="중개사무소 찾기, 매물 상세의 사무소 카드, 사무소 공개 페이지에 보이는 정보예요."
      />
      {isPending ? (
        <ProfileSkeleton />
      ) : isError ? (
        <Panel>
          <ErrorState
            compact
            title="사무소 프로필을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => void refetch()}
            code={error instanceof ApiError ? error.requestId : undefined}
          />
        </Panel>
      ) : !agency ? (
        <Panel>
          <ErrorState
            compact
            title="소속 사무소를 찾을 수 없어요"
            description="사무소 등록 신청 상태를 확인해 주세요."
            action={
              <Button href={AGENT_ROUTES.apply} linkAs={Link} variant="secondary">
                등록 정보 보기
              </Button>
            }
          />
        </Panel>
      ) : (
        <ProfileEditor key={agency.id} agency={agency} />
      )}
    </ConsolePage>
  );
}
