'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ErrorState, Icon, Input, LoadingRegion, Skeleton, useToast } from '@house/ui';
import Link from 'next/link';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { LinkedAccountsPanel } from '@/features/w-auth/components/account/LinkedAccountsPanel';
import { AUTH_ROUTES } from '@/features/w-auth/routes';
import { useProfile, useUpdateProfile } from '../api';
import {
  profileFormDefaults,
  profileFormSchema,
  roleCaption,
  toProfilePatch,
  type ProfileFormValues,
} from '../lib/profile';
import type { Profile } from '../schemas';
import { MarketingConsentCard } from './MarketingConsentCard';
import { SoftButton } from './SoftButton';
import styles from './ProfileView.module.css';

function ProfileSkeleton() {
  return (
    <LoadingRegion label="내 정보 불러오는 중" className={styles.view}>
      {[220, 132, 196].map((h) => (
        <div key={h} className={styles.card}>
          <Skeleton width={120} height={20} />
          <Skeleton height={h - 80} radius={12} style={{ marginTop: 20 }} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** 내 정보: 닉네임·연락처, 마케팅 수신 동의, 연결된 계정, 로그아웃·회원 탈퇴. */
export function ProfileView() {
  const profile = useProfile();

  if (profile.isPending) return <ProfileSkeleton />;
  if (profile.isError)
    return (
      <div className={styles.card}>
        <ErrorState
          title="내 정보를 불러오지 못했어요"
          description={errorMessage(profile.error)}
          onRetry={() => void profile.refetch()}
        />
      </div>
    );

  return (
    <div className={styles.view}>
      <BasicInfoCard profile={profile.data} />
      <MarketingConsentCard profile={profile.data} />
      {/* 연결된 계정: the self-contained panel of the w-auth group (link / unlink included). */}
      <LinkedAccountsPanel />
      <AccountCard profile={profile.data} />
    </div>
  );
}

function BasicInfoCard({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const update = useUpdateProfile();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onBlur',
    defaultValues: profileFormDefaults(profile),
  });
  const { errors, isDirty } = form.formState;

  // Follow server-side changes (e.g. the consent switch saved separately) without losing edits.
  useEffect(() => {
    form.reset(profileFormDefaults(profile), { keepDirtyValues: true });
  }, [profile, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (update.isPending) return;
    const patch = toProfilePatch(values, profile);
    delete patch.marketingOptIn; // saved by its own switch
    if (Object.keys(patch).length === 0) {
      form.reset(profileFormDefaults(profile));
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      form.reset(profileFormDefaults(saved));
      toast('내 정보를 저장했어요.');
    } catch (e) {
      if (e instanceof ApiError && e.isValidation) {
        const fields = e.fieldErrors();
        let mapped = false;
        (['nickname', 'phone'] as const).forEach((key) => {
          const message = fields[key];
          if (message) {
            // The first rejected field takes the focus, like a client-side validation error.
            form.setError(key, { message }, { shouldFocus: !mapped });
            mapped = true;
          }
        });
        if (mapped) return;
      }
      toast({ message: errorMessage(e), tone: 'error' });
    }
  });

  return (
    <section className={styles.card} aria-labelledby="me-basic-h">
      <header className={styles.cardHead}>
        <h2 id="me-basic-h" className={styles.cardTitle}>
          기본 정보
        </h2>
        <p className={styles.cardDesc}>닉네임과 연락처는 언제든 바꿀 수 있어요.</p>
      </header>
      <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
        <Input
          label="닉네임"
          required
          maxLength={20}
          autoComplete="nickname"
          help="문의나 요청을 보낼 때 중개사무소에 보이는 이름이에요. 2~20자, 띄어쓰기 없이 써 주세요."
          error={errors.nickname?.message}
          {...form.register('nickname')}
        />
        <Input
          label="연락처"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="010-0000-0000"
          help="본인 인증 없이 연락용으로만 쓰여요. 내놓기·구하기 요청을 쓸 때 자동으로 채워지고, 동의한 중개사무소에만 공개돼요."
          error={errors.phone?.message}
          {...form.register('phone')}
        />
        <dl className={styles.readonly}>
          <div>
            <dt>이름</dt>
            <dd>{profile.name || '등록되지 않음'}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            <dd>{profile.email || '등록되지 않음'}</dd>
          </div>
          <p>이름과 이메일은 로그인한 소셜 계정에서 가져온 정보예요.</p>
        </dl>
        <div className={styles.formActions}>
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || update.isPending}
            onClick={() => {
              form.reset(profileFormDefaults(profile));
              // This button switches itself off: continue from the first field.
              form.setFocus('nickname');
            }}
          >
            되돌리기
          </Button>
          {/* Never natively disabled: it keeps the focus while saving and once the form is clean. */}
          <SoftButton type="submit" unavailable={!isDirty} busy={update.isPending}>
            저장
          </SoftButton>
        </div>
      </form>
    </section>
  );
}

function AccountCard({ profile }: { profile: Profile }) {
  const { logout } = useSession();
  return (
    <section className={styles.card} aria-labelledby="me-account-h">
      <header className={styles.cardHead}>
        <h2 id="me-account-h" className={styles.cardTitle}>
          계정
        </h2>
        <p className={styles.cardDesc}>
          {roleCaption(profile.role)}
          {profile.createdAt && ` · ${formatDate(profile.createdAt)} 가입`}
        </p>
      </header>
      <ul className={styles.links}>
        <li>
          <Link href={AUTH_ROUTES.account} className={styles.linkRow}>
            <Icon name="shield" size={20} />
            <span>
              <b>계정 설정</b>
              <span>약관 동의 내역, 모든 기기에서 로그아웃</span>
            </span>
            <Icon name="chevron-right" size={18} className={styles.chev} />
          </Link>
        </li>
        <li>
          <button type="button" className={styles.linkRow} onClick={() => void logout()}>
            <Icon name="logout" size={20} />
            <span>
              <b>로그아웃</b>
              <span>이 기기에서 로그아웃해요.</span>
            </span>
          </button>
        </li>
      </ul>
      <p className={styles.withdraw}>
        더 이상 이용하지 않으시나요?
        <Link href={AUTH_ROUTES.withdraw}>회원 탈퇴</Link>
      </p>
    </section>
  );
}
