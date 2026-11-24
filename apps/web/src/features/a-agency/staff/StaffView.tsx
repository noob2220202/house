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
import {
  agencyKeys,
  createInvite,
  fetchInvites,
  fetchMembers,
  removeMember,
  revokeInvite,
  updateMember,
} from '../api/queries';
import {
  INVITE_EXPIRY_HOURS,
  inviteFormSchema,
  licenseFormSchema,
  type AgencyInvite,
  type AgencyMember,
  type InviteFormValues,
  type LicenseFormValues,
} from '../api/schemas';
import { formatInviteCode } from '../lib/registration';
import {
  expiryLabel,
  licensePayload,
  memberKindLabel,
  openInvites,
  staffSummary,
  toInvitePayload,
} from '../lib/staff';
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
  const [issued, setIssued] = useState<AgencyInvite | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { label: '', expiresInHours: 72 },
  });

  const close = () => {
    onClose();
    // Reset after the close animation so the dialog does not flash back to the form.
    setTimeout(() => {
      setIssued(null);
      reset();
    }, 200);
  };

  const submit = async (values: InviteFormValues) => {
    try {
      const invite = await createInvite(toInvitePayload(values));
      setIssued(invite);
      onInvited();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        Object.entries(error.fieldErrors()).forEach(([key, message]) =>
          setError(key as keyof InviteFormValues, { type: 'server', message }),
        );
        return;
      }
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  if (issued) {
    const code = formatInviteCode(issued.code ?? '');
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
            {issued.label ? (
              <>
                <b>{issued.label}</b> 님께 아래 코드를 전달해 주세요.
              </>
            ) : (
              <>합류할 직원에게 아래 코드를 전달해 주세요.</>
            )}{' '}
            {formatDate(issued.expiresAt)}까지 한 번만 쓸 수 있어요.
          </p>
          <p className={styles.bigCode} aria-label={`초대 코드 ${code.split('').join(' ')}`}>
            {code}
          </p>
          <Callout tone="warn">
            코드는 지금 한 번만 보여 드려요. 창을 닫기 전에 복사해서 전달해 주세요.
          </Callout>
          <ol className={styles.steps}>
            <li>직원이 본인 계정(카카오·네이버·Google)으로 로그인해요.</li>
            <li>‘중개사 회원 가입 → 초대 코드로 합류’에서 코드를 입력해요.</li>
            <li>
              합류하면 중개보조원으로 등록돼요. 공인중개사면 목록에서 자격증 번호를 등록해 주세요.
            </li>
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
      description="한 번만 쓸 수 있는 초대 코드를 만들어 합류할 직원에게 전달해요."
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
        <Input
          label="메모 (선택)"
          autoComplete="off"
          placeholder="예: 이도윤 실장"
          maxLength={50}
          help="누구에게 보낸 코드인지 구분하는 메모예요. 직원에게는 보이지 않아요."
          error={errors.label?.message}
          {...register('label')}
        />
        <Controller
          control={control}
          name="expiresInHours"
          render={({ field }) => (
            <RadioGroup
              label="유효 기간"
              name="invite-expiry"
              value={String(field.value)}
              onChange={(v) => field.onChange(Number(v))}
              options={INVITE_EXPIRY_HOURS.map((h) => ({
                value: String(h),
                label: expiryLabel(h),
              }))}
            />
          )}
        />
        <Callout tone="info">
          합류한 직원은 중개보조원으로 시작해요. 소속공인중개사는 합류 후 자격증 번호를 등록해야
          매물 광고에 이름을 표시할 수 있어요.
        </Callout>
      </form>
    </Modal>
  );
}

/** 소속공인중개사 지정 (자격증 번호) — 공인중개사법 제18조의2①: 광고에는 공인중개사만 표시. */
function LicenseModal({
  member,
  onClose,
  onSaved,
}: {
  member: AgencyMember | null;
  onClose: () => void;
  onSaved: (member: AgencyMember) => void;
}) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: { licenseNumber: '' },
  });

  const close = () => {
    onClose();
    setTimeout(() => reset(), 200);
  };

  const submit = async (values: LicenseFormValues) => {
    if (!member) return;
    try {
      const saved = await updateMember(member.id, licensePayload(true, values.licenseNumber));
      toast({ message: `${saved.displayName} 님을 소속공인중개사로 등록했어요.` });
      onSaved(saved);
      close();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const message = error.fieldErrors().licenseNumber ?? error.message;
        setError('licenseNumber', { type: 'server', message });
        return;
      }
      toast({ message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <Modal
      open={!!member}
      onClose={close}
      size="sm"
      title="소속공인중개사로 등록"
      description={
        member ? `${member.displayName} 님의 공인중개사 자격증 번호를 확인해서 입력해 주세요.` : ''
      }
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form="license-form" loading={isSubmitting}>
            등록
          </Button>
        </>
      }
    >
      <form
        id="license-form"
        className={styles.form}
        onSubmit={(e) => void handleSubmit(submit)(e)}
        noValidate
      >
        <Input
          label="자격증 번호"
          required
          autoComplete="off"
          placeholder="예: 2019-전남-00847"
          error={errors.licenseNumber?.message}
          {...register('licenseNumber')}
        />
        <Callout tone="info">
          자격증 원본을 확인한 뒤 등록해 주세요. 등록하면 이 직원을 매물 광고의 담당자로 지정할 수
          있어요.
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
  const [revoking, setRevoking] = useState<AgencyInvite | null>(null);
  const [licensing, setLicensing] = useState<AgencyMember | null>(null);
  const [demoting, setDemoting] = useState<AgencyMember | null>(null);

  const members = useQuery({
    queryKey: agencyKeys.members,
    queryFn: ({ signal }) => fetchMembers(signal),
    enabled: isOwner,
  });
  const invites = useQuery({
    queryKey: agencyKeys.invites,
    queryFn: ({ signal }) => fetchInvites(signal),
    enabled: isOwner,
  });

  const replaceMember = (next: AgencyMember) =>
    queryClient.setQueryData<AgencyMember[]>(agencyKeys.members, (prev) =>
      prev?.map((m) => (m.id === next.id ? { ...m, ...next } : m)),
    );

  const remove = useMutation({
    mutationFn: (member: AgencyMember) => removeMember(member.id),
    onSuccess: async (_data, member) => {
      queryClient.setQueryData<AgencyMember[]>(agencyKeys.members, (prev) =>
        prev?.filter((m) => m.id !== member.id),
      );
      setRemoving(null);
      toast({ message: `${member.displayName} 님을 내보냈어요.` });
      await queryClient.invalidateQueries({ queryKey: agencyKeys.members });
    },
    onError: (err) => {
      setRemoving(null);
      toast({ message: errorMessage(err), tone: 'error' });
    },
  });

  const revoke = useMutation({
    mutationFn: (invite: AgencyInvite) => revokeInvite(invite.id),
    onSuccess: async (_data, invite) => {
      queryClient.setQueryData<AgencyInvite[]>(agencyKeys.invites, (prev) =>
        prev?.filter((i) => i.id !== invite.id),
      );
      setRevoking(null);
      toast({ message: '초대를 취소했어요. 그 코드는 더 이상 쓸 수 없어요.' });
      await queryClient.invalidateQueries({ queryKey: agencyKeys.invites });
    },
    onError: (err) => {
      setRevoking(null);
      toast({ message: errorMessage(err), tone: 'error' });
    },
  });

  const demote = useMutation({
    mutationFn: (member: AgencyMember) => updateMember(member.id, licensePayload(false)),
    onSuccess: (saved) => {
      replaceMember(saved);
      setDemoting(null);
      toast({ message: `${saved.displayName} 님을 중개보조원으로 바꿨어요.` });
    },
    onError: (err) => {
      setDemoting(null);
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

  const isPending = members.isPending || invites.isPending;
  const failed = members.isError ? members : invites.isError ? invites : null;
  const active = (members.data ?? []).filter((m) => m.status === AgencyMemberStatus.ACTIVE);
  const open = openInvites(invites.data ?? []);
  const summary = staffSummary(active, invites.data ?? []);

  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow="사무소"
        title="직원 관리"
        description="소속 공인중개사와 중개보조원을 초대하고, 퇴사한 직원은 내보내 주세요. 초대 코드는 한 사람만, 정한 기간 동안 쓸 수 있어요."
        actions={
          <Button
            iconLeft={<Icon name="plus" size={18} />}
            onClick={() => setInviteOpen(true)}
            disabled={isPending || !!failed}
          >
            직원 초대
          </Button>
        }
      />

      {isPending ? (
        <StaffSkeleton />
      ) : failed ? (
        <Panel>
          <ErrorState
            compact
            title="직원 목록을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => {
              void members.refetch();
              void invites.refetch();
            }}
            code={failed.error instanceof ApiError ? failed.error.requestId : undefined}
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
                      {typeof m.activeListingCount === 'number' && (
                        <>
                          <i aria-hidden="true" />
                          <span>
                            담당 매물 <b>{m.activeListingCount}</b>건
                          </span>
                        </>
                      )}
                      {m.isLicensed && m.licenseNumber && m.role !== AgencyMemberRole.OWNER && (
                        <>
                          <i aria-hidden="true" />
                          <span>자격증 {m.licenseNumber}</span>
                        </>
                      )}
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
                      <>
                        {m.isLicensed ? (
                          <Button variant="ghost" size="sm" onClick={() => setDemoting(m)}>
                            중개보조원으로
                            <span className="sr-only"> — {m.displayName}</span>
                          </Button>
                        ) : (
                          <Button variant="soft" size="sm" onClick={() => setLicensing(m)}>
                            공인중개사 등록
                            <span className="sr-only"> — {m.displayName}</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                          내보내기
                          <span className="sr-only"> — {m.displayName}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="초대 대기"
            count={open.length || undefined}
            description="아직 쓰이지 않은 초대 코드예요. 코드는 만들 때 한 번만 보여 드려요."
            flush
          >
            {open.length === 0 ? (
              <EmptyState
                compact
                icon="mail"
                title="대기 중인 초대가 없어요"
                description="‘직원 초대’로 코드를 만들어 전달해 주세요."
              />
            ) : (
              <ul className={styles.list}>
                {open.map((invite) => (
                  <li key={invite.id} className={styles.row}>
                    <Avatar name={invite.label ?? '초대'} size={44} tone="neutral" />
                    <div className={styles.main}>
                      <p className={styles.name}>
                        {invite.label ?? '이름 없는 초대'}
                        <span className={styles.code}>····-{invite.codeHint}</span>
                      </p>
                      <p className={styles.meta}>
                        <span>{formatDate(invite.createdAt)} 발급</span>
                        <i aria-hidden="true" />
                        <span>
                          코드 만료까지 <b>{formatDday(invite.expiresAt)}</b>
                        </span>
                      </p>
                    </div>
                    <div className={styles.actions}>
                      <Button variant="ghost" size="sm" onClick={() => setRevoking(invite)}>
                        초대 취소
                        <span className="sr-only"> — {invite.label ?? invite.codeHint}</span>
                      </Button>
                    </div>
                  </li>
                ))}
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
        onInvited={() => void queryClient.invalidateQueries({ queryKey: agencyKeys.invites })}
      />
      <LicenseModal member={licensing} onClose={() => setLicensing(null)} onSaved={replaceMember} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
        loading={remove.isPending}
        danger
        title={`${removing?.displayName ?? ''} 님을 내보낼까요?`}
        description="내보내면 이 직원은 중개사 콘솔을 쓸 수 없고, 담당하던 매물은 대표 계정으로 넘어가요."
        confirmLabel="내보내기"
        cancelLabel="닫기"
      />
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        loading={revoke.isPending}
        danger
        title="이 초대를 취소할까요?"
        description="전달한 초대 코드는 더 이상 쓸 수 없어요. 필요하면 새 코드를 만들어 주세요."
        confirmLabel="초대 취소"
        cancelLabel="닫기"
      />
      <ConfirmDialog
        open={!!demoting}
        onClose={() => setDemoting(null)}
        onConfirm={() => demoting && demote.mutate(demoting)}
        loading={demote.isPending}
        title={`${demoting?.displayName ?? ''} 님을 중개보조원으로 바꿀까요?`}
        description="중개보조원은 매물 광고에 이름을 표시할 수 없어요. 이 직원이 담당하던 광고의 연락 담당은 대표로 바뀌어요."
        confirmLabel="중개보조원으로 변경"
        cancelLabel="닫기"
      />
    </ConsolePage>
  );
}
