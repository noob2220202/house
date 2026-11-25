'use client';
import {
  AGENCY_STATUS_LABEL,
  AUTH_PROVIDER_LABEL,
  ROLE_LABEL,
  TERMS_TYPE_LABEL,
  UserRole,
  UserStatus,
} from '@house/shared';
import {
  Avatar,
  BackLink,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Icon,
  Panel,
  ProviderTile,
  StatusPill,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatPhone, formatRelativeTime } from '@/lib/format';
import u from './users.module.css';
import { fetchUser, modKeys, suspendUser, unsuspendUser } from '../api/queries';
import type { AdminUserDetail } from '../api/schemas';
import {
  USER_ROLE_SHORT,
  USER_STATUS_META,
  isScrubbed,
  shortId,
  isScrubbedMember,
  userDisplayName,
} from '../lib/labels';
import { USER_SUSPEND_PRESETS } from '../lib/reasons';
import {
  AuditNotice,
  DetailError,
  DetailGrid,
  DetailHero,
  DetailSkeleton,
  InfoList,
  MiniStats,
  Timeline,
} from '../ui/Detail';
import { ReasonDialog } from '../ui/ReasonDialog';
import s from '../ui/ui.module.css';

type Dialog = 'suspend' | 'unsuspend' | null;

function IdentitiesPanel({ user }: { user: AdminUserDetail }) {
  return (
    <Panel
      title="연결된 로그인 수단"
      count={user.identities.length}
      description="카카오 · 네이버 · Google 간편 로그인"
      flush
    >
      {user.identities.length === 0 ? (
        <p className={s.actionHint} style={{ padding: 20 }}>
          {isScrubbed(user)
            ? '개인정보 파기와 함께 연결 정보가 삭제됐어요.'
            : '연결된 로그인 수단이 없어요.'}
        </p>
      ) : (
        <ul className={s.rows}>
          {user.identities.map((identity) => (
            <li key={identity.id} className={u.identity}>
              {/* decorative: the provider name follows as text */}
              <ProviderTile provider={identity.provider} size="lg" />
              <span className={u.identityMain}>
                <span className={u.identityTitle}>
                  {AUTH_PROVIDER_LABEL[identity.provider]}
                  {identity.emailVerified ? (
                    <Badge tone="success">이메일 인증됨</Badge>
                  ) : (
                    <Badge>이메일 미인증</Badge>
                  )}
                </span>
                <span className={u.identitySub}>
                  {identity.email ?? '제공받은 이메일 없음'}
                  <span className="only-sm"> · {formatDate(identity.createdAt)} 연결</span>
                </span>
              </span>
              <span className={u.identityDates}>
                <span>{formatDate(identity.createdAt)} 연결</span>
                {identity.lastUsedAt && (
                  <span>최근 사용 {formatRelativeTime(identity.lastUsedAt)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ConsentsPanel({ user }: { user: AdminUserDetail }) {
  return (
    <Panel
      title="약관 동의 내역"
      count={user.consents.length}
      description="가입·재동의 시점의 약관 버전 기준"
      flush
    >
      {user.consents.length === 0 ? (
        <p className={s.actionHint} style={{ padding: 20 }}>
          동의 내역이 없어요.
        </p>
      ) : (
        <div className={u.consentWrap}>
          <table className={u.consents}>
            <caption className="sr-only">약관 동의 내역</caption>
            <thead>
              <tr>
                <th scope="col">약관</th>
                <th scope="col">구분</th>
                <th scope="col">동의 여부</th>
                <th scope="col">일시</th>
              </tr>
            </thead>
            <tbody>
              {user.consents.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.termsTitle ?? TERMS_TYPE_LABEL[c.termsType]}
                    <span className={u.consentVer}>v{c.version}</span>
                  </th>
                  <td>{c.isRequired ? <Badge tone="ink">필수</Badge> : <Badge>선택</Badge>}</td>
                  <td>
                    <span className={`${s.inlineIcon} ${c.agreed ? s.okText : s.mutedText}`}>
                      <Icon name={c.agreed ? 'check-circle' : 'x-circle'} size={16} />
                      {c.agreed ? '동의' : '동의 안 함'}
                    </span>
                  </td>
                  <td className={`${s.num} ${u.consentDate}`}>{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** 회원 상세 (`/users/[id]`): profile, linked identities, consents, sanctions + suspend / unsuspend. */
export function UserDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);

  const {
    data: user,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: modKeys.user(id),
    queryFn: ({ signal }) => fetchUser(id, signal),
    // Every fetch is an audit-logged read of personal data: do not refetch behind the admin's back.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const sanction = useMutation({
    mutationFn: (v: { kind: 'suspend' | 'unsuspend'; reason: string }) =>
      v.kind === 'suspend' ? suspendUser(id, v.reason) : unsuspendUser(id),
    onSuccess: (next, v) => {
      queryClient.setQueryData(modKeys.user(id), next);
      void queryClient.invalidateQueries({ queryKey: ['admin-users', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users', 'counts'] });
      toast(
        v.kind === 'suspend'
          ? '이용을 정지했어요. 모든 기기에서 로그아웃됐어요.'
          : '이용 정지를 해제했어요.',
      );
      setDialog(null);
    },
    onError: (err) => {
      if (dialog === 'unsuspend') {
        toast({ message: errorMessage(err), tone: 'error' });
        setDialog(null);
      }
    },
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !user)
    return (
      <DetailError
        error={error}
        onRetry={() => void refetch()}
        backHref={ADMIN_ROUTES.users}
        backLabel="회원 목록으로"
        subject="회원"
      />
    );

  const status = USER_STATUS_META[user.status];
  const scrubbed = isScrubbed(user);
  const anonymous = isScrubbedMember(user);
  const name = anonymous ? '탈퇴한 회원' : userDisplayName(user);
  const isBroker = user.role !== UserRole.USER;
  const activity = user.activity;

  return (
    <div className={s.detail}>
      <AdminPageHeader
        title="회원 상세"
        crumb={['매물 · 회원', { label: '회원 관리', href: ADMIN_ROUTES.users }]}
      />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.users}>
        회원 목록
      </BackLink>

      <DetailHero
        icon={
          <Avatar name={anonymous ? '–' : name} size={48} tone={anonymous ? 'neutral' : 'soft'} />
        }
        eyebrow={
          <>
            회원 <span className={s.num}>{shortId(user.id)}</span>
          </>
        }
        title={name}
        badges={
          <>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            <Badge
              tone={user.role === UserRole.AGENCY_OWNER ? 'ink' : isBroker ? 'brand' : 'neutral'}
            >
              {USER_ROLE_SHORT[user.role]}
            </Badge>
          </>
        }
        meta={
          <>
            {user.name && (
              <span>
                <Icon name="user" size={14} />
                {user.name}
              </span>
            )}
            <span>
              <Icon name="calendar" size={14} />
              {formatDate(user.createdAt)} 가입
            </span>
            {user.lastLoginAt && (
              <span>
                <Icon name="clock" size={14} />
                최근 로그인 {formatRelativeTime(user.lastLoginAt)}
              </span>
            )}
          </>
        }
      />

      <AuditNotice subject="회원 개인정보" />
      {user.status === UserStatus.SUSPENDED && (
        <Callout size="sm" tone="danger">
          <strong>이용이 정지된 회원이에요.</strong>
          {user.suspendedAt ? (
            <> {formatDate(user.suspendedAt)}부터 로그인할 수 없어요.</>
          ) : (
            <> 로그인할 수 없는 상태예요.</>
          )}{' '}
          정지 사유와 해제는 계정 상태에서 확인할 수 있어요.
        </Callout>
      )}
      {user.status === UserStatus.WITHDRAWN && (
        <Callout size="sm" tone="muted">
          <strong>탈퇴한 회원이에요.</strong>{' '}
          {scrubbed
            ? `개인정보는 ${user.piiScrubbedAt ? formatDate(user.piiScrubbedAt) : ''}에 파기됐고, 법령상 보관이 필요한 기록만 남아 있어요.`
            : `${user.withdrawnAt ? `${formatDate(user.withdrawnAt)}에 탈퇴했고, ` : ''}개인정보는 ${
                user.piiScrubAfter ? formatDate(user.piiScrubAfter) : '보관 기간이 끝나는 날'
              }에 파기돼요.`}
          {user.withdrawalReason && <> 탈퇴 사유: {user.withdrawalReason}</>}
        </Callout>
      )}

      <DetailGrid
        main={
          <>
            <Panel title="기본 정보">
              <InfoList
                items={[
                  { label: '닉네임', value: user.nickname },
                  { label: '이름', value: user.name },
                  { label: '이메일', value: user.email },
                  {
                    label: '연락처',
                    value: user.phone ? (
                      <>
                        <span className={s.num}>{formatPhone(user.phone)}</span>
                        <span className={s.mutedText}> · 본인 입력값</span>
                      </>
                    ) : null,
                  },
                  { label: '회원 유형', value: ROLE_LABEL[user.role] },
                  {
                    label: '소속 사무소',
                    value: user.agency ? (
                      <>
                        <Link href={`${ADMIN_ROUTES.agencies}/${user.agency.id}`} className="link">
                          {user.agency.name}
                        </Link>
                        <span className={s.mutedText}>
                          {' '}
                          ·{' '}
                          {[
                            user.agency.memberRole === 'OWNER' ? '대표' : '소속',
                            user.agency.status ? AGENCY_STATUS_LABEL[user.agency.status] : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </>
                    ) : null,
                  },
                  { label: '가입일', value: formatDateTime(user.createdAt) },
                  {
                    label: '최근 로그인',
                    value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : null,
                  },
                  {
                    label: '마케팅 수신',
                    value: user.marketingOptIn ? '동의' : '동의 안 함',
                  },
                ]}
              />
            </Panel>

            <IdentitiesPanel user={user} />
            <ConsentsPanel user={user} />

            {activity && (
              <Panel title="활동">
                <MiniStats
                  items={[
                    { label: '내놓기·구하기', value: activity.dealRequestCount, unit: '건' },
                    { label: '허위매물 신고', value: activity.reportCount, unit: '건' },
                    { label: '관심 매물', value: activity.favoriteCount, unit: '건' },
                    { label: '로그인 중인 기기', value: activity.activeSessionCount, unit: '대' },
                  ]}
                />
                {user.nickname && activity.dealRequestCount > 0 && (
                  <div className={u.activity}>
                    <Button
                      size="sm"
                      variant="secondary"
                      href={`${ADMIN_ROUTES.dealRequests}?q=${encodeURIComponent(user.nickname)}`}
                      linkAs={Link}
                      iconRight={<Icon name="chevron-right" size={16} />}
                    >
                      이 회원의 내놓기·구하기
                    </Button>
                  </div>
                )}
              </Panel>
            )}
          </>
        }
        side={
          <>
            <Panel title="계정 상태">
              <div className={s.sideStatus}>
                <span>현재 상태</span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
              {user.status === UserStatus.ACTIVE && (
                <div className={s.actions}>
                  <Button
                    variant="danger"
                    block
                    onClick={() => {
                      sanction.reset();
                      setDialog('suspend');
                    }}
                  >
                    이용 정지
                  </Button>
                  <p className={s.actionHint}>
                    정지하면 모든 기기에서 바로 로그아웃되고 다시 로그인할 수 없어요.
                    {isBroker && ' 중개사 콘솔도 쓸 수 없게 돼요.'}
                  </p>
                </div>
              )}
              {user.status === UserStatus.SUSPENDED && (
                <>
                  {user.suspendedReason && (
                    <p className={s.reasonBox}>
                      <strong>정지 사유</strong>
                      {user.suspendedReason}
                    </p>
                  )}
                  <div className={s.actions}>
                    <Button block onClick={() => setDialog('unsuspend')}>
                      정지 해제
                    </Button>
                    <p className={s.actionHint}>해제하면 바로 다시 로그인할 수 있어요.</p>
                  </div>
                </>
              )}
              {user.status === UserStatus.WITHDRAWN && (
                <p className={s.actionHint}>
                  탈퇴한 회원은 상태를 바꿀 수 없어요. 같은 간편 로그인으로 다시 가입하면 새
                  회원으로 등록돼요.
                </p>
              )}
            </Panel>

            <Panel title="제재 이력" count={user.sanctions.length || undefined}>
              <Timeline
                label="제재 이력"
                items={user.sanctions.map((item) => ({
                  id: item.id,
                  tone: item.action === 'SUSPENDED' ? 'danger' : 'success',
                  title: item.action === 'SUSPENDED' ? '이용 정지' : '정지 해제',
                  meta: [item.adminName, formatDateTime(item.createdAt)]
                    .filter(Boolean)
                    .join(' · '),
                  note: item.reason ?? undefined,
                }))}
              />
            </Panel>
          </>
        }
      />

      <ReasonDialog
        open={dialog === 'suspend'}
        onClose={() => {
          setDialog(null);
          sanction.reset();
        }}
        title="이용 정지"
        description="정지 사유는 회원에게 그대로 안내돼요. 정지하면 모든 기기에서 로그아웃되고, 해제하기 전까지 로그인할 수 없어요."
        target={{
          title: name,
          sub: `${USER_ROLE_SHORT[user.role]} · ${formatDate(user.createdAt)} 가입`,
        }}
        reasonLabel="정지 사유"
        presets={USER_SUSPEND_PRESETS}
        confirmLabel="이용 정지"
        danger
        loading={sanction.isPending}
        error={sanction.isError && dialog === 'suspend' ? errorMessage(sanction.error) : null}
        onConfirm={(reason) => sanction.mutate({ kind: 'suspend', reason })}
      />
      <ConfirmDialog
        open={dialog === 'unsuspend'}
        onClose={() => setDialog(null)}
        onConfirm={() => sanction.mutate({ kind: 'unsuspend', reason: '' })}
        title="이용 정지를 해제할까요?"
        description={`${name} 회원이 바로 다시 로그인할 수 있게 돼요.`}
        confirmLabel="정지 해제"
        loading={sanction.isPending}
      />
    </div>
  );
}
