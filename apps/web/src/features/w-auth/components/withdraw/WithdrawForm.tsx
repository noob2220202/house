'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_LABEL, UserRole } from '@house/shared';
import {
  Avatar,
  Button,
  Checkbox,
  ConfirmDialog,
  Icon,
  RadioGroup,
  Textarea,
  useToast,
  type IconName,
} from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ROUTES } from '@/config/nav';
import { ApiError, errorMessage } from '@/lib/api';
import type { SessionUser } from '@/lib/auth';
import { withdrawAccount } from '../../api';
import { clearRecentProvider } from '../../lib/recent-provider';
import {
  WITHDRAW_DETAIL_MAX,
  WITHDRAW_REASONS,
  buildWithdrawReason,
  withdrawFormSchema,
  type WithdrawFormValues,
} from '../../lib/withdraw';
import { AUTH_ROUTES } from '../../routes';
import styles from './withdraw.module.css';

const NOTES: readonly { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'heart',
    title: '내 활동 기록이 모두 삭제돼요',
    text: '관심 매물·단지, 최근 본 매물, 관심 지역과 알림 내역을 다시 볼 수 없어요.',
  },
  {
    icon: 'home-up',
    title: '진행 중인 내놓기·구하기 요청이 마감돼요',
    text: '중개사무소에서 받은 제안도 함께 닫히고, 공개에 동의한 연락처는 더 이상 보이지 않아요.',
  },
  {
    icon: 'shield',
    title: '개인정보는 분리 보관 후 파기해요',
    text: '탈퇴 즉시 로그인이 차단되고, 개인정보처리방침에서 정한 기간이 지나면 복구할 수 없게 파기해요.',
  },
  {
    icon: 'refresh',
    title: '다시 가입해도 이전 정보는 돌아오지 않아요',
    text: '같은 소셜 계정으로 새로 가입할 수 있지만 예전 기록은 이어지지 않아요.',
  },
];

export interface WithdrawFormProps {
  user: Pick<SessionUser, 'nickname' | 'role' | 'email'>;
}

/** 회원 탈퇴: consequences, optional reason, explicit consent, then a final confirmation dialog. */
export function WithdrawForm({ user }: WithdrawFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<WithdrawFormValues | null>(null);
  const blockRef = useRef<HTMLParagraphElement>(null);
  const isOwner = user.role === UserRole.AGENCY_OWNER;
  const [blocked, setBlocked] = useState<string | null>(
    isOwner
      ? '중개사무소 대표 계정은 사무소를 폐업 처리하거나 대표를 변경한 뒤 탈퇴할 수 있어요.'
      : null,
  );

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: { detail: '', confirmed: false },
  });
  const { errors } = form.formState;
  const detailLength = (form.watch('detail') ?? '').length;

  const withdraw = useMutation({
    mutationFn: (values: WithdrawFormValues) =>
      withdrawAccount({ reason: buildWithdrawReason(values.reason, values.detail) }),
    onSuccess: () => {
      clearRecentProvider();
      queryClient.clear();
      // Full navigation: every cached page of the signed-in user must go.
      window.location.assign(AUTH_ROUTES.withdrawn);
    },
    onError: (error) => {
      setPending(null);
      if (error instanceof ApiError && error.status === 409) {
        setBlocked(error.message);
        // The notice replaces the form at the top — take the reader there.
        requestAnimationFrame(() => blockRef.current?.focus());
      } else toast({ message: errorMessage(error), tone: 'error' });
    },
  });

  return (
    <form
      className={styles.view}
      noValidate
      onSubmit={(e) => void form.handleSubmit((values) => setPending(values))(e)}
    >
      {/* Blocked (대표 계정, 409): say so first, above the fold, and drop the form below. */}
      {blocked && (
        <p className={styles.block} role="alert" tabIndex={-1} ref={blockRef}>
          <Icon name="info" size={18} />
          <span>
            <b>지금은 탈퇴할 수 없어요</b>
            {blocked} {isOwner && <Link href={ROUTES.agent}>중개사 콘솔로 가기</Link>}
          </span>
        </p>
      )}

      <section className={styles.card} aria-labelledby="wd-notes-h">
        <div className={styles.who}>
          <Avatar name={user.nickname} size={40} />
          <span className={styles.whoText}>
            <b>{user.nickname}님</b>
            <span>
              {ROLE_LABEL[user.role]}
              {user.email ? ` · ${user.email}` : ''}
            </span>
          </span>
        </div>
        <h2 id="wd-notes-h" className={styles.cardTitle}>
          탈퇴 전에 꼭 확인해 주세요
        </h2>
        <p className={styles.cardDesc}>탈퇴는 되돌릴 수 없어요. 아래 내용을 천천히 읽어 주세요.</p>
        <ul className={styles.notes}>
          {NOTES.map((note) => (
            <li key={note.title}>
              <span className={styles.noteIc}>
                <Icon name={note.icon} size={18} />
              </span>
              <span className={styles.noteText}>
                <b>{note.title}</b>
                <span>{note.text}</span>
              </span>
            </li>
          ))}
          {user.role === UserRole.AGENT && (
            <li>
              <span className={styles.noteIc}>
                <Icon name="store" size={18} />
              </span>
              <span className={styles.noteText}>
                <b>소속 중개사무소에서 제외돼요</b>
                <span>중개사 콘솔을 더 이상 쓸 수 없고, 사무소 구성원 목록에서 빠져요.</span>
              </span>
            </li>
          )}
        </ul>
      </section>

      {!blocked && (
        <>
          <section className={styles.card} aria-labelledby="wd-reason-h">
            <h2 id="wd-reason-h" className={styles.cardTitle}>
              떠나시는 이유를 알려 주세요
              <span className={styles.optional}>선택</span>
            </h2>
            <p className={styles.cardDesc}>더 나은 서비스를 만드는 데에만 참고할게요.</p>
            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <RadioGroup<string>
                  className={styles.reasons}
                  label="탈퇴 사유"
                  hideLabel
                  name="withdraw-reason"
                  direction="column"
                  options={WITHDRAW_REASONS}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            <Textarea
              id="withdraw-detail"
              fieldClassName={styles.detail}
              label="더 하고 싶은 말씀"
              rows={3}
              maxLength={WITHDRAW_DETAIL_MAX}
              placeholder="불편했던 점이나 바라는 점을 적어 주세요."
              help={`${detailLength} / ${WITHDRAW_DETAIL_MAX}자`}
              error={errors.detail?.message}
              {...form.register('detail')}
            />
          </section>

          <div className={styles.confirm}>
            <Checkbox
              aria-invalid={errors.confirmed ? true : undefined}
              aria-describedby={errors.confirmed ? 'wd-confirm-error' : undefined}
              {...form.register('confirmed')}
            >
              안내 사항을 모두 확인했고, 회원 탈퇴에 동의해요.
            </Checkbox>
            {errors.confirmed && (
              <p id="wd-confirm-error" className={styles.confirmError} role="alert">
                {errors.confirmed.message}
              </p>
            )}
          </div>
        </>
      )}

      <div className={styles.actions}>
        <Button href={ROUTES.me} linkAs={Link} variant="secondary" size="lg">
          계속 이용하기
        </Button>
        <Button type="submit" variant="danger" size="lg" disabled={blocked !== null}>
          탈퇴하기
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && withdraw.mutate(pending)}
        title="정말 탈퇴할까요?"
        description="탈퇴하면 모든 기기에서 로그아웃되고, 내 정보와 활동 기록은 되돌릴 수 없어요."
        confirmLabel="탈퇴하기"
        cancelLabel="계속 이용하기"
        danger
        loading={withdraw.isPending || withdraw.isSuccess}
      />
    </form>
  );
}
