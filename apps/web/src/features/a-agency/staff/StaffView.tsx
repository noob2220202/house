'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AgencyMemberRole, AgencyMemberStatus } from '@house/shared';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  LoadingRegion,
  Modal,
  Panel,
  RadioGroup,
  Skeleton,
  StatTile,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatDday, formatPhone } from '@/lib/format';
import { agencyKeys, fetchMembers, inviteMember, removeMember } from '../api/queries';
import { inviteMemberSchema, type AgencyMember, type InviteMemberInput } from '../api/schemas';
import { formatInviteCode } from '../lib/registration';
import { memberKindLabel, staffSummary, toInvitePayload } from '../lib/staff';
import { AGENT_ROUTES } from '../nav';
import { ConsolePage, ConsolePageHeader } from '../shell';
import styles from './Staff.module.css';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function KindBadge({ member }: { member: AgencyMember }) {
  if (member.role === AgencyMemberRole.OWNER) return <Badge tone="ink">대표</Badge>;
  return <Badge tone={member.isLicensed ? 'brand' : 'neutral'}>{memberKindLabel(member)}</Badge>;
}

function InviteModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const { toast } = useToast();
  const [issued, setIssued] = useState<AgencyMember | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { displayName: '', title: '', isLicensed: true, licenseNumber: '', phone: '' },
  });
  const licensed = watch('isLicensed');

  const close = () => {
    onClose();
    // Reset after the close animation so the dialog does not flash back to the form.
    setTimeout(() => {
      setIssued(null);
      reset();
    }, 200);
  };

  const submit = async (values: InviteMemberInput) => {
    try {
      const member = await inviteMember(toInvitePayload(values));
      setIssued(member);
      onInvited();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        Object.entries(error.fieldErrors()).forEach(([key, message]) =>
          setError(key as keyof InviteMemberInput, { type: 'server', message }),
        );
        return;
      }
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  if (issued) {
    const code = formatInviteCode(issued.inviteCode ?? '');
    return (
      <Modal
        open={open}
        onClose={close}
        title="초대 코드를 만들었어요"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              닫기
            </Button>
            <Button
              iconLeft={<Icon name="copy" size={18} />}
              onClick={() =>
                void copyText(code).then((ok) =>
                  toast(
                    ok
                      ? { message: '초대 코드를 복사했어요.' }
                      : {
                          message: '복사하지 못했어요. 코드를 직접 선택해서 복사해 주세요.',
                          tone: 'error',
                        },
                  ),
                )
              }
            >
              코드 복사
            </Button>
          </>
        }
      >
        <div className={styles.issued}>
          <span className={styles.issuedIcon}>
            <Icon name="check" size={26} strokeWidth={2.5} />
          </span>
          <p className={styles.issuedText}>
            <b>{issued.displayName}</b> 님께 아래 코드를 전달해 주세요.
            {issued.inviteExpiresAt && <> {formatDate(issued.inviteExpiresAt)}까지 쓸 수 있어요.</>}
          </p>
          <p className={styles.bigCode} aria-label={`초대 코드 ${code.split('').join(' ')}`}>
            {code}
          </p>
          <ol className={styles.steps}>
            <li>직원이 본인 계정(카카오·네이버·Google)으로 로그인해요.</li>
            <li>‘중개사 회원 가입 → 초대 코드로 합류’에서 코드를 입력해요.</li>
            <li>합류하면 이 화면의 소속 직원 목록에 나타나요.</li>
          </ol>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="직원 초대"
      description="초대 코드를 만들어 소속 공인중개사나 중개보조원에게 전달해요."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form="invite-form" loading={isSubmitting}>
            초대 코드 만들기
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        className={styles.form}
        onSubmit={(e) => void handleSubmit(submit)(e)}
        noValidate
      >
        <div className={styles.grid2}>
          <Input
            label="이름"
            required
            autoComplete="off"
            placeholder="예: 이도윤"
            error={errors.displayName?.message}
            {...register('displayName')}
          />
          <Input
            label="직함 (선택)"
            autoComplete="off"
            placeholder="예: 실장, 과장"
            error={errors.title?.message}
            {...register('title')}
          />
        </div>
        <Controller
          control={control}
          name="isLicensed"
          render={({ field }) => (
            <RadioGroup
              label="구분"
              name="invite-kind"
              value={field.value ? 'licensed' : 'assistant'}
              onChange={(v) => field.onChange(v === 'licensed')}
              options={[
                { value: 'licensed', label: '소속공인중개사' },
                { value: 'assistant', label: '중개보조원' },
              ]}
            />
          )}
        />
        <div className={styles.grid2}>
          {licensed && (
            <Input
              label="자격증 번호 (선택)"
              autoComplete="off"
              placeholder="예: 전남-2019-00847"
              error={errors.licenseNumber?.message}
              {...register('licenseNumber')}
            />
          )}
          <Input
            label="휴대폰 번호 (선택)"
            inputMode="tel"
            autoComplete="off"
            placeholder="010-0000-0000"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>
        <Callout tone="info">
          중개보조원은 현장 안내 등 보조 업무만 할 수 있고, 매물에는 항상 사무소와 대표 공인중개사
          정보가 함께 표시돼요.
        </Callout>
      </form>
    </Modal>
  );
}

function StaffSkeleton() {
  return (
    <LoadingRegion label="직원 목록을 불러오는 중">
      <div className={styles.summary}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={104} radius={16} />
        ))}
      </div>
      <Skeleton height={280} radius={16} style={{ marginTop: 20 }} />
    </LoadingRegion>
  );
}

export interface StaffViewProps {
  /** False for 소속 중개사 (AGENT) — the page explains that only the owner manages staff. */
  isOwner: boolean;
}

/** /agent/staff — members, invitations (one-time codes) and removal. Agency owner only. */
export function StaffView({ isOwner }: StaffViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<AgencyMember | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: agencyKeys.members,
    queryFn: ({ signal }) => fetchMembers(signal),
    enabled: isOwner,
  });

  const remove = useMutation({
    mutationFn: (member: AgencyMember) => removeMember(member.id),
    onSuccess: async (_data, member) => {
      queryClient.setQueryData<AgencyMember[]>(agencyKeys.members, (prev) =>
        prev?.filter((m) => m.id !== member.id),
      );
      setRemoving(null);
      toast({
        message:
          member.status === AgencyMemberStatus.INVITED
            ? '초대를 취소했어요.'
            : `${member.displayName} 님을 내보냈어요.`,
      });
      await queryClient.invalidateQueries({ queryKey: agencyKeys.members });
    },
    onError: (err) => {
      setRemoving(null);
      toast({ message: errorMessage(err), tone: 'error' });
    },
  });

  if (!isOwner) {
    return (
      <ConsolePage>
        <ConsolePageHeader eyebrow="사무소" title="직원 관리" />
        <Panel>
          <EmptyState
            icon="lock"
            title="대표 공인중개사만 볼 수 있어요"
            description="직원 초대와 내보내기는 사무소 대표 계정에서 할 수 있어요."
            action={
              <Button href={AGENT_ROUTES.dashboard} linkAs={Link} variant="secondary">
                대시보드로 이동
              </Button>
            }
          />
        </Panel>
      </ConsolePage>
    );
  }

  const members = data ?? [];
  const active = members.filter((m) => m.status === AgencyMemberStatus.ACTIVE);
  const invited = members.filter((m) => m.status === AgencyMemberStatus.INVITED);
  const summary = staffSummary(members);

  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow="사무소"
        title="직원 관리"
        description="소속 공인중개사와 중개보조원을 초대하고, 퇴사한 직원은 내보내 주세요. 초대 코드는 한 사람만, 7일 동안 쓸 수 있어요."
        actions={
          <Button
            iconLeft={<Icon name="plus" size={18} />}
            onClick={() => setInviteOpen(true)}
            disabled={isPending || isError}
          >
            직원 초대
          </Button>
        }
      />

      {isPending ? (
        <StaffSkeleton />
      ) : isError ? (
        <Panel>
          <ErrorState
            compact
            title="직원 목록을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => void refetch()}
            code={error instanceof ApiError ? error.requestId : undefined}
          />
        </Panel>
      ) : (
        <>
          <div className={styles.summary}>
            <StatTile
              label="소속 인원"
              value={summary.total}
              unit="명"
              icon={<Icon name="users" size={18} />}
              detail="대표 포함"
            />
            <StatTile
              label="공인중개사"
              value={summary.licensed}
              unit="명"
              icon={<Icon name="shield" size={18} />}
              iconTone="brand"
              detail={`개업 1 · 소속 ${Math.max(0, summary.licensed - 1)}`}
            />
            <StatTile
              label="중개보조원"
              value={summary.assistants}
              unit="명"
              icon={<Icon name="user" size={18} />}
              detail={`최대 ${summary.assistantLimit}명까지 둘 수 있어요`}
            />
          </div>

          <Panel title="소속 직원" count={active.length} flush>
            <ul className={styles.list}>
              {active.map((m) => (
                <li key={m.id} className={styles.row}>
                  <Avatar
                    name={m.displayName}
                    size={44}
                    tone={m.role === 'OWNER' ? 'ink' : 'soft'}
                  />
                  <div className={styles.main}>
                    <p className={styles.name}>
                      {m.displayName}
                      {m.title && m.role !== AgencyMemberRole.OWNER && (
                        <span className={styles.title}>{m.title}</span>
                      )}
                      <KindBadge member={m} />
                    </p>
                    <p className={styles.meta}>
                      {m.joinedAt && <span>{formatDate(m.joinedAt)} 합류</span>}
                      <i aria-hidden="true" />
                      <span>
                        담당 매물 <b>{m.activeListingCount ?? 0}</b>건
                      </span>
                      {m.phone && (
                        <>
                          <i aria-hidden="true" />
                          <span>{formatPhone(m.phone)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    {m.role === AgencyMemberRole.OWNER ? (
                      <span className={styles.self}>사무소 대표</span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                        내보내기
                        <span className="sr-only"> — {m.displayName}</span>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="초대 대기"
            count={invited.length || undefined}
            description="아직 합류하지 않은 초대예요"
            flush
          >
            {invited.length === 0 ? (
              <EmptyState
                compact
                icon="mail"
                title="대기 중인 초대가 없어요"
                description="‘직원 초대’로 코드를 만들어 전달해 주세요."
              />
            ) : (
              <ul className={styles.list}>
                {invited.map((m) => {
                  const code = formatInviteCode(m.inviteCode ?? '');
                  const dday = m.inviteExpiresAt ? formatDday(m.inviteExpiresAt) : '';
                  return (
                    <li key={m.id} className={styles.row}>
                      <Avatar name={m.displayName} size={44} tone="neutral" />
                      <div className={styles.main}>
                        <p className={styles.name}>
                          {m.displayName}
                          {m.title && <span className={styles.title}>{m.title}</span>}
                          <KindBadge member={m} />
                        </p>
                        <p className={styles.meta}>
                          {dday === '종료' ? (
                            <span className={styles.expired}>코드 만료</span>
                          ) : (
                            <span>
                              코드 만료까지 <b>{dday}</b>
                            </span>
                          )}
                        </p>
                      </div>
                      <div className={styles.actions}>
                        {code && (
                          <span className={styles.code}>
                            {code}
                            <IconButton
                              label={`${m.displayName} 초대 코드 복사`}
                              size={32}
                              variant="plain"
                              onClick={() =>
                                void copyText(code).then((ok) =>
                                  toast(
                                    ok
                                      ? { message: '초대 코드를 복사했어요.' }
                                      : { message: '복사하지 못했어요.', tone: 'error' },
                                  ),
                                )
                              }
                            >
                              <Icon name="copy" size={16} />
                            </IconButton>
                          </span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                          초대 취소
                          <span className="sr-only"> — {m.displayName}</span>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Callout tone="info" title="고용·고용관계 종료 신고를 잊지 마세요">
            소속공인중개사나 중개보조원을 고용하거나 고용관계가 끝나면 등록관청(순천시청)에 신고해야
            해요. 여기서 내보내도 신고가 대신 처리되지는 않아요.
          </Callout>
        </>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => void queryClient.invalidateQueries({ queryKey: agencyKeys.members })}
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
        loading={remove.isPending}
        danger
        title={
          removing?.status === AgencyMemberStatus.INVITED
            ? `${removing.displayName} 님의 초대를 취소할까요?`
            : `${removing?.displayName ?? ''} 님을 내보낼까요?`
        }
        description={
          removing?.status === AgencyMemberStatus.INVITED
            ? '발급한 초대 코드는 더 이상 쓸 수 없어요.'
            : '내보내면 이 직원은 중개사 콘솔을 쓸 수 없고, 담당하던 매물은 대표 계정으로 넘어가요.'
        }
        confirmLabel={removing?.status === AgencyMemberStatus.INVITED ? '초대 취소' : '내보내기'}
        cancelLabel="닫기"
      />
    </ConsolePage>
  );
}
