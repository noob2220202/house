'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  ErrorState,
  Icon,
  Input,
  Modal,
  Skeleton,
  cx,
  useToast,
} from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AdminPageHeader } from '@/components/shell';
import { ApiError, errorMessage } from '@/lib/api';
import { ADMIN_SESSION_QUERY_KEY, useAdminSession } from '@/lib/auth/session';
import { adminRoleLabel } from '@/lib/auth/types';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { changePassword, coreKeys, fetchAccount, type TotpResult, type TotpSetup } from '../../api';
import { ROLE_SUMMARY, navAccess } from '../../lib/access';
import { ADMIN_PASSWORD_MAX, ADMIN_PASSWORD_MIN, passwordIssue } from '../../lib/otp';
import styles from '../core.module.css';
import { TotpEnroll } from '../login/TotpEnroll';
import { RecoveryCodes } from '../login/TotpStep';
import { TotpReauthForm } from './TotpReauthForm';

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.panelHd}>
        <h2 className={styles.panelT}>{title}</h2>
        {aside}
      </div>
      <div className={styles.cardBd}>{children}</div>
    </section>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해 주세요.').max(200),
    newPassword: z
      .string()
      .max(ADMIN_PASSWORD_MAX, `비밀번호는 ${ADMIN_PASSWORD_MAX}자 이하로 입력해 주세요.`)
      .superRefine((value, ctx) => {
        const issue = passwordIssue(value);
        if (issue) ctx.addIssue({ code: 'custom', message: issue });
      }),
    confirmPassword: z.string().min(1, '새 비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: '새 비밀번호가 서로 다릅니다.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    mode: 'onBlur',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const submit = handleSubmit(async (values) => {
    try {
      // The API rotates this session (new CSRF token, kept by the API client) and ends the others.
      const result = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      queryClient.setQueryData(coreKeys.account(), result.admin);
      reset();
      toast('비밀번호를 변경했어요. 다른 기기의 로그인은 모두 종료됐어요.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_INVALID_CREDENTIALS') {
        setError(
          'currentPassword',
          { message: '현재 비밀번호가 올바르지 않습니다.' },
          { shouldFocus: true },
        );
        return;
      }
      const fields = error instanceof ApiError ? error.fieldErrors() : {};
      let mapped = false;
      (['currentPassword', 'newPassword'] as const).forEach((name) => {
        if (fields[name]) {
          setError(name, { message: fields[name] }, { shouldFocus: !mapped });
          mapped = true;
        }
      });
      if (!mapped) toast({ message: errorMessage(error), tone: 'error' });
    }
  });
  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <Input
        label="현재 비밀번호"
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="새 비밀번호"
        type="password"
        autoComplete="new-password"
        required
        help={`영문·숫자 포함 ${ADMIN_PASSWORD_MIN}자 이상`}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="새 비밀번호 확인"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <div className={styles.formActions}>
        <Button type="submit" loading={isSubmitting}>
          비밀번호 변경
        </Button>
      </div>
    </form>
  );
}

type ReenrollStep =
  | { name: 'reauth' }
  | { name: 'enroll'; setup: TotpSetup }
  | { name: 'codes'; codes: readonly string[] };

/** Recovery codes left below which the account page asks for a re-enrolment (new set of 10). */
const RECOVERY_LOW = 3;

function TotpCard({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const [step, setStep] = useState<ReenrollStep | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const close = () => {
    setStep(null);
    setNotice(null);
  };
  const onActivated = (result: TotpResult) => {
    // The API rotated this session and ended every other one: refresh what the page shows.
    queryClient.setQueryData(coreKeys.account(), result.admin);
    void queryClient.invalidateQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
    setNotice(null);
    setStep({ name: 'codes', codes: result.recoveryCodes ?? [] });
  };
  const low = enabled && recoveryLeft <= RECOVERY_LOW;
  return (
    <Card
      title="2단계 인증"
      aside={<Badge tone={enabled ? 'success' : 'warn'}>{enabled ? '사용 중' : '등록 필요'}</Badge>}
    >
      <p className={styles.hint}>
        로그인할 때마다 인증 앱(TOTP)의 6자리 코드를 확인합니다. 관리자 계정은 2단계 인증을 끌 수
        없습니다.
      </p>
      <dl className={styles.facts}>
        <dt>남은 복구 코드</dt>
        <dd>
          {recoveryLeft}개{' '}
          {low && <Badge tone="warn">{recoveryLeft === 0 ? '없음' : '얼마 남지 않음'}</Badge>}
        </dd>
      </dl>
      <div className={styles.rowBetween}>
        <p className={styles.hint}>
          {low
            ? '인증 앱을 다시 등록하면 새 복구 코드 10개를 받습니다.'
            : '휴대폰을 바꿨다면 인증 앱을 다시 등록하세요.'}
        </p>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Icon name="refresh" size={16} />}
          onClick={() => setStep({ name: 'reauth' })}
        >
          인증 앱 다시 등록
        </Button>
      </div>
      <Modal
        open={step !== null}
        onClose={close}
        size="md"
        title={step?.name === 'codes' ? '새 복구 코드' : '인증 앱 다시 등록'}
        description={
          step?.name === 'codes'
            ? '이전 복구 코드는 더 이상 쓸 수 없습니다. 새 코드를 안전한 곳에 보관해 주세요.'
            : step?.name === 'enroll'
              ? '등록을 마치면 이전 기기의 인증 코드는 더 이상 쓸 수 없고, 다른 기기의 로그인도 모두 종료됩니다.'
              : '본인 확인을 위해 현재 비밀번호와 지금 쓰는 인증 앱의 코드(또는 복구 코드)를 입력해 주세요.'
        }
        footer={
          step?.name === 'codes' ? (
            <Button
              onClick={() => {
                close();
                toast('인증 앱을 다시 등록했어요');
              }}
            >
              보관했어요
            </Button>
          ) : undefined
        }
      >
        {step?.name === 'codes' && (
          <div className={styles.form}>
            <RecoveryCodes codes={step.codes} />
          </div>
        )}
        {step?.name === 'reauth' && (
          <div className={styles.form}>
            {notice && (
              <Callout tone="warn" size="sm" live>
                {notice}
              </Callout>
            )}
            <TotpReauthForm
              onCancel={close}
              onSetup={(setup) => {
                setNotice(null);
                setStep({ name: 'enroll', setup });
              }}
            />
          </div>
        )}
        {step?.name === 'enroll' && (
          <TotpEnroll
            initialSetup={step.setup}
            onVerified={onActivated}
            onSetupExpired={(message) => {
              // The pending secret is gone; a new one needs a fresh re-authentication.
              setNotice(message);
              setStep({ name: 'reauth' });
            }}
            submitLabel="다시 등록 완료"
          />
        )}
      </Modal>
    </Card>
  );
}

/** 내 계정: profile, role & menu access, TOTP re-enrolment, password change. */
export function AccountView() {
  const { admin, logout } = useAdminSession();
  const account = useQuery({
    queryKey: coreKeys.account(),
    queryFn: ({ signal }) => fetchAccount(signal),
    staleTime: 60_000,
  });
  const me = account.data ?? admin ?? null;
  const access = me ? navAccess(me.role) : [];

  return (
    <div className={styles.page}>
      <AdminPageHeader title="내 계정" crumb={['계정 · 2단계 인증']} />
      {!me ? (
        account.isError ? (
          <div className={styles.state}>
            <ErrorState
              title="계정 정보를 불러오지 못했어요"
              description={errorMessage(account.error)}
              onRetry={() => void account.refetch()}
            />
          </div>
        ) : (
          <Skeleton height={320} radius={16} />
        )
      ) : (
        <div className={styles.accountGrid}>
          <div className={styles.stack}>
            <Card
              title="계정 정보"
              aside={
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Icon name="logout" size={16} />}
                  onClick={() => void logout()}
                >
                  로그아웃
                </Button>
              }
            >
              <div className={styles.profile}>
                <Avatar name={me.name} size={56} />
                <div>
                  <p className={styles.profileName}>
                    {me.name}
                    <Badge tone="ink">{adminRoleLabel(me.role)}</Badge>
                  </p>
                  <p className={styles.profileMail}>{me.email}</p>
                </div>
              </div>
              <dl className={styles.facts}>
                <dt>권한</dt>
                <dd>{ROLE_SUMMARY[me.role]}</dd>
                {me.lastLoginAt && (
                  <>
                    <dt>최근 로그인</dt>
                    <dd>
                      {formatDateTime(me.lastLoginAt)} ({formatRelativeTime(me.lastLoginAt)})
                    </dd>
                  </>
                )}
                {account.data?.lastLoginIp && (
                  <>
                    <dt>접속 IP</dt>
                    <dd>{account.data.lastLoginIp}</dd>
                  </>
                )}
              </dl>
              <p className={styles.hint}>
                이름·이메일·권한은 최고관리자가 관리자 계정 메뉴에서 변경합니다.
              </p>
            </Card>
            <Card title="메뉴 접근 권한">
              <ul className={styles.access}>
                {access.map((item) => (
                  <li key={item.href} className={cx(!item.allowed && styles.locked)}>
                    <Icon name={item.allowed ? 'check-circle' : 'lock'} size={18} />
                    <span>
                      {item.label} <small>{item.group}</small>
                    </span>
                    <span>
                      {item.allowed ? (
                        <span className="sr-only">사용 가능</span>
                      ) : (
                        <Badge>{adminRoleLabel(item.minRole)} 이상</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className={styles.stack}>
            <TotpCard
              enabled={account.data?.totpEnabled ?? me.totpEnabled}
              recoveryLeft={account.data?.recoveryCodesRemaining ?? me.recoveryCodesRemaining}
            />
            <Card title="비밀번호 변경">
              <PasswordForm />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
