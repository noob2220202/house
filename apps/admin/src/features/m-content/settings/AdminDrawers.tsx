'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ADMIN_ROLES, AdminRole, AdminStatus, ROLE_LABEL } from '@house/shared';
import {
  Button,
  Callout,
  ConfirmDialog,
  Drawer,
  Icon,
  IconButton,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@house/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { admins } from '../api';
import {
  adminCreateSchema,
  adminEditFormSchema,
  adminPasswordResetSchema,
  ipAllowlistSchema,
  type AdminCreateForm,
  type AdminEditForm,
} from '../api/inputs';
import type { AdminAccount } from '../api/schemas';
import drawer from '../components/drawer.module.css';
import s from '../components/shared.module.css';
import {
  adminAccountState,
  generateTempPassword,
  ipAllowedBy,
  parseIpAllowlist,
} from '../lib/admins';
import { applyServerErrors } from '../lib/form-errors';
import styles from './settings.module.css';

const ROLE_OPTIONS = [...ADMIN_ROLES]
  .reverse()
  .map((role) => ({ value: role, label: ROLE_LABEL[role] }));

/** Password input with show / hide and a generator for one-time temporary passwords. */
function TempPasswordField({
  field,
  error,
  onGenerate,
}: {
  field: UseFormRegisterReturn;
  error?: string;
  onGenerate: (password: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.pwField}>
      <Input
        label="임시 비밀번호"
        required
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        spellCheck={false}
        help="12자 이상 · 영문, 숫자, 특수문자 포함"
        error={error}
        suffix={
          <IconButton
            label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
            size={32}
            variant="plain"
            onClick={() => setVisible((v) => !v)}
          >
            <Icon name={visible ? 'lock' : 'eye'} size={18} />
          </IconButton>
        }
        {...field}
      />
      <button
        type="button"
        className={styles.pwGenerate}
        onClick={() => {
          onGenerate(generateTempPassword());
          setVisible(true);
        }}
      >
        <Icon name="refresh" size={14} />
        자동 생성
      </button>
    </div>
  );
}

export function AdminCreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, setError, formState } = useForm<AdminCreateForm>(
    {
      resolver: zodResolver(adminCreateSchema),
      defaultValues: { email: '', name: '', role: AdminRole.OPERATOR, password: '' },
      mode: 'onBlur',
    },
  );
  useEffect(() => {
    if (open) reset({ email: '', name: '', role: AdminRole.OPERATOR, password: '' });
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (values: AdminCreateForm) => admins.create(values),
    onSuccess: (saved) => {
      toast(`${saved.name} 님의 계정을 만들었어요. 임시 비밀번호를 안전하게 전달해 주세요.`);
      onCreated();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'ADMIN_EMAIL_TAKEN') {
        setError('email', { message: '이미 등록된 이메일이에요.' });
        return;
      }
      const message = applyServerErrors(e, setError, ['email', 'name', 'role', 'password']);
      if (message) toast({ message, tone: 'error' });
    },
  });
  const errors = formState.errors;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="관리자 추가"
      width={480}
      footer={
        <div className={drawer.footer}>
          <span className={drawer.spacer} />
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="admin-create-form" loading={create.isPending}>
            계정 만들기
          </Button>
        </div>
      }
    >
      <form
        id="admin-create-form"
        className={s.stack}
        noValidate
        onSubmit={(e) => void handleSubmit((v) => create.mutate(v))(e)}
      >
        <Input
          label="이메일"
          required
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="name@example.com"
          help="로그인 아이디로 써요. 만든 뒤에는 바꿀 수 없어요."
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="이름"
          required
          maxLength={50}
          autoComplete="off"
          error={errors.name?.message}
          {...register('name')}
        />
        <Select
          label="권한"
          required
          options={ROLE_OPTIONS}
          error={errors.role?.message}
          {...register('role')}
        />
        <TempPasswordField
          field={register('password')}
          error={errors.password?.message}
          onGenerate={(pw) => setValue('password', pw, { shouldDirty: true, shouldValidate: true })}
        />
        <Callout size="sm" tone="muted" icon="shield">
          첫 로그인 때 비밀번호를 바꾸고 OTP 앱(2단계 인증)을 등록해요. 임시 비밀번호는 저장한 뒤
          다시 볼 수 없으니 지금 복사해 두세요.
        </Callout>
      </form>
    </Drawer>
  );
}

function PasswordResetModal({
  account,
  open,
  onClose,
}: {
  account: AdminAccount;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, setError, formState } = useForm<{
    password: string;
  }>({
    resolver: zodResolver(adminPasswordResetSchema),
    defaultValues: { password: '' },
  });
  useEffect(() => {
    if (open) reset({ password: '' });
  }, [open, reset]);
  const mutation = useMutation({
    mutationFn: (v: { password: string }) => admins.resetPassword(account.id, v.password),
    onSuccess: () => {
      toast(`${account.name} 님의 비밀번호를 다시 설정했어요.`);
      onClose();
    },
    onError: (e) => {
      const message = applyServerErrors(e, setError, ['password']);
      if (message) toast({ message, tone: 'error' });
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="임시 비밀번호 설정"
      description={`${account.name} (${account.email})`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="admin-password-form" loading={mutation.isPending}>
            비밀번호 설정
          </Button>
        </>
      }
    >
      <form
        id="admin-password-form"
        className={s.stack}
        noValidate
        onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)}
      >
        <TempPasswordField
          field={register('password')}
          error={formState.errors.password?.message}
          onGenerate={(pw) => setValue('password', pw, { shouldDirty: true, shouldValidate: true })}
        />
        <Callout size="sm" tone="warn">
          설정하면 이 계정의 로그인이 모두 해제되고 잠금도 풀려요. 임시 비밀번호는 다시 볼 수 없으니
          안전한 방법으로 직접 전달해 주세요.
        </Callout>
      </form>
    </Modal>
  );
}

export function AdminEditDrawer({
  account,
  isSelf,
  onClose,
  onChanged,
}: {
  /** null = closed */
  account: AdminAccount | null;
  isSelf: boolean;
  onClose: () => void;
  /** Called after any successful change; `closed` when the drawer should close. */
  onChanged: (closed: boolean) => void;
}) {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<'totp' | 'delete' | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const locked = account ? adminAccountState(account) === 'locked' : false;
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<AdminEditForm>({
      resolver: zodResolver(adminEditFormSchema),
      defaultValues: {
        name: '',
        role: AdminRole.OPERATOR,
        status: AdminStatus.ACTIVE,
        ipAllowlistText: '',
      },
      mode: 'onBlur',
    });
  useEffect(() => {
    if (account)
      reset({
        name: account.name,
        role: account.role,
        status: account.status,
        ipAllowlistText: account.ipAllowlist.join('\n'),
      });
  }, [account, reset]);

  const save = useMutation({
    mutationFn: (v: AdminEditForm) => {
      const ipAllowlist = parseIpAllowlist(v.ipAllowlistText);
      const parsed = ipAllowlistSchema.safeParse(ipAllowlist);
      if (!parsed.success)
        throw new IpError(parsed.error.issues[0]?.message ?? '허용 IP를 확인해 주세요.');
      return admins.update(account?.id ?? '', {
        name: v.name,
        ...(isSelf ? {} : { role: v.role, status: v.status }),
        ipAllowlist,
      });
    },
    onSuccess: () => {
      toast('계정 정보를 저장했어요.');
      onChanged(true);
    },
    onError: (e) => {
      if (e instanceof IpError) {
        setError('ipAllowlistText', { message: e.message });
        return;
      }
      const message = applyServerErrors(e, setError, ['name', 'role', 'status']);
      if (message) toast({ message, tone: 'error' });
    },
  });
  const resetTotp = useMutation({
    mutationFn: () => admins.resetTotp(account?.id ?? ''),
    onSuccess: () => {
      setConfirm(null);
      toast('OTP를 초기화했어요. 다음 로그인 때 다시 등록해요.');
      onChanged(false);
    },
    onError: (e) => {
      setConfirm(null);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });
  const remove = useMutation({
    mutationFn: () => admins.remove(account?.id ?? ''),
    onSuccess: () => {
      setConfirm(null);
      toast('관리자 계정을 삭제했어요.');
      onChanged(true);
    },
    onError: (e) => {
      setConfirm(null);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });
  const unlock = useMutation({
    mutationFn: () => admins.unlock(account?.id ?? ''),
    onSuccess: () => {
      toast('계정 잠금을 풀었어요.');
      onChanged(false);
    },
    onError: (e) => {
      setConfirm(null);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  const errors = formState.errors;
  const status = watch('status');
  const ipAllowlistText = watch('ipAllowlistText');

  return (
    <>
      <Drawer
        open={account !== null}
        onClose={onClose}
        title="관리자 계정"
        width={520}
        footer={
          <div className={drawer.footer}>
            <span className={drawer.spacer} />
            <Button type="button" variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" form="admin-edit-form" loading={save.isPending}>
              저장
            </Button>
          </div>
        }
      >
        {account && (
          <div className={s.stackLg}>
            <form
              id="admin-edit-form"
              className={s.stack}
              noValidate
              onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
            >
              <Input label="이메일" value={account.email} readOnly disabled />
              <Input
                label="이름"
                required
                maxLength={50}
                autoComplete="off"
                error={errors.name?.message}
                {...register('name')}
              />
              <Select
                label="권한"
                required
                disabled={isSelf}
                options={ROLE_OPTIONS}
                help={isSelf ? '본인 계정의 권한과 상태는 바꿀 수 없어요.' : undefined}
                error={errors.role?.message}
                {...register('role')}
              />
              <div className={s.switchRow}>
                <div className={s.switchText}>
                  <span className={s.switchLabel}>계정 사용</span>
                  <span className={s.switchHelp}>
                    끄면 로그인할 수 없고, 이미 로그인한 화면도 바로 해제돼요.
                  </span>
                </div>
                <Switch
                  aria-label="계정 사용"
                  disabled={isSelf}
                  checked={status === AdminStatus.ACTIVE}
                  onChange={(e) =>
                    setValue(
                      'status',
                      e.target.checked ? AdminStatus.ACTIVE : AdminStatus.DISABLED,
                      {
                        shouldDirty: true,
                      },
                    )
                  }
                />
              </div>
              <Textarea
                label="허용 IP"
                rows={3}
                spellCheck={false}
                placeholder={'203.0.113.10\n203.0.113.0/24'}
                help="한 줄에 하나씩 · 비워 두면 어디서나 로그인할 수 있어요."
                error={errors.ipAllowlistText?.message}
                {...register('ipAllowlistText')}
              />
              {isSelf &&
                account.lastLoginIp &&
                !ipAllowedBy(account.lastLoginIp, parseIpAllowlist(ipAllowlistText)) && (
                  <Callout size="sm" tone="warn">
                    지금 로그인한 IP <strong>{account.lastLoginIp}</strong>가 목록에 없어요. 이대로
                    저장하면 이 주소에서는 본인 계정으로 다시 로그인할 수 없어요.
                  </Callout>
                )}
            </form>

            <section className={styles.section} aria-labelledby="admin-security-title">
              <h3 id="admin-security-title" className={styles.sectionTitle}>
                보안
              </h3>
              <dl className={s.facts}>
                <dt>2단계 인증</dt>
                <dd>{account.totpEnabled ? 'OTP 앱 등록됨' : '아직 등록하지 않음'}</dd>
                <dt>최근 로그인</dt>
                <dd>
                  {account.lastLoginAt
                    ? `${formatDateTime(account.lastLoginAt)}${account.lastLoginIp ? ` · ${account.lastLoginIp}` : ''}`
                    : '로그인한 적 없음'}
                </dd>
                {locked && (
                  <>
                    <dt>잠금</dt>
                    <dd>
                      {account.lockedUntil
                        ? `${formatDateTime(account.lockedUntil)}까지 (인증 실패 반복)`
                        : '인증 실패 반복으로 잠김'}
                    </dd>
                  </>
                )}
                <dt>계정 생성</dt>
                <dd>{formatDateTime(account.createdAt)}</dd>
              </dl>
              <div className={styles.actionRow}>
                <p className={styles.actionText}>
                  <b>임시 비밀번호 설정</b>
                  비밀번호를 잊었거나 계정이 잠겼을 때 써요.
                </p>
                <Button type="button" variant="secondary" onClick={() => setPasswordOpen(true)}>
                  비밀번호 설정
                </Button>
              </div>
              <div className={styles.actionRow}>
                <p className={styles.actionText}>
                  <b>OTP 초기화</b>
                  휴대폰을 바꿨을 때 써요. 다음 로그인 때 다시 등록해요.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!account.totpEnabled}
                  onClick={() => setConfirm('totp')}
                >
                  OTP 초기화
                </Button>
              </div>
              {locked && (
                <div className={styles.actionRow}>
                  <p className={styles.actionText}>
                    <b>잠금 해제</b>
                    인증 코드를 여러 번 틀려 잠긴 계정을 바로 풀어요.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={unlock.isPending}
                    onClick={() => unlock.mutate()}
                  >
                    잠금 해제
                  </Button>
                </div>
              )}
              {!isSelf && (
                <div className={styles.actionRow}>
                  <p className={styles.actionText}>
                    <b>계정 삭제</b>
                    작업 기록은 남고, 같은 이메일로 다시 만들 수 있어요.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className={s.dangerText}
                    onClick={() => setConfirm('delete')}
                  >
                    계정 삭제
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </Drawer>

      {account && (
        <>
          <PasswordResetModal
            account={account}
            open={passwordOpen}
            onClose={() => setPasswordOpen(false)}
          />
          <ConfirmDialog
            open={confirm === 'totp'}
            onClose={() => setConfirm(null)}
            onConfirm={() => resetTotp.mutate()}
            title="OTP를 초기화할까요?"
            description={`${account.name} 님은 다음 로그인 때 OTP 앱을 다시 등록해야 해요. 지금 로그인한 화면은 모두 해제돼요.`}
            confirmLabel="초기화"
            loading={resetTotp.isPending}
          />
          <ConfirmDialog
            open={confirm === 'delete'}
            onClose={() => setConfirm(null)}
            onConfirm={() => remove.mutate()}
            title="관리자 계정을 삭제할까요?"
            description={`${account.name} (${account.email}) 계정으로 더 이상 로그인할 수 없어요. 잠시 막으려면 삭제 대신 '계정 사용'을 꺼 주세요.`}
            confirmLabel="삭제"
            danger
            loading={remove.isPending}
          />
        </>
      )}
    </>
  );
}

class IpError extends Error {}
