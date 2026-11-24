'use client';
import {
  AGENCY_DOCUMENT_TYPE_LABEL,
  ASSET_TYPE_LABEL,
  AUTH_PROVIDER_LABEL,
  AgencyDocumentType,
  AgencyStatus,
} from '@house/shared';
import {
  BackLink,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Icon,
  Panel,
  StatusPill,
  Tag,
  cx,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { env } from '@/config/env';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatCount, formatDate, formatDateTime, formatPhone } from '@/lib/format';
import a from './agencies.module.css';
import { DocumentViewer } from './DocumentViewer';
import {
  decideAgency,
  fetchAgency,
  fetchAgencyRegistry,
  modKeys,
  recheckAgencyRegistry,
} from '../api/queries';
import type { AdminAgencyDetail, AdminAgencyDocument, RegistryCheck } from '../api/schemas';
import {
  AGENCY_STATUS_META,
  REGISTRY_STATUS_META,
  REQUIRED_AGENCY_DOCUMENTS,
  documentSummary,
  waitingDays,
  waitingLabel,
} from '../lib/labels';
import {
  AGENCY_APPROVE_OVERRIDE_PRESETS,
  AGENCY_REJECT_PRESETS,
  AGENCY_SUSPEND_PRESETS,
} from '../lib/reasons';
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

/** 'override' = approve although the automatic checks are not clean (needs a written reason). */
type Decision = 'approve' | 'override' | 'reject' | 'suspend' | 'restore';

const formatBusinessNumber = (v: string) => v.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');
const formatBytes = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
const fullAddress = (ag: Pick<AdminAgencyDetail, 'roadAddress' | 'addressDetail'>) =>
  [ag.roadAddress, ag.addressDetail].filter(Boolean).join(', ');

/** The detail with the separately loaded registry check (kept when the lookup has not answered). */
export function withRegistry(
  detail: AdminAgencyDetail | undefined,
  check: RegistryCheck | undefined,
): AdminAgencyDetail | undefined {
  if (!detail || !check) return detail;
  return { ...detail, registryCheck: check, registryStatus: check.status };
}

/** Latest document per type (re-uploads supersede older files). */
function latestDocuments(docs: readonly AdminAgencyDocument[]): AdminAgencyDocument[] {
  const byType = new Map<AgencyDocumentType, AdminAgencyDocument>();
  for (const d of docs) {
    const prev = byType.get(d.type);
    if (!prev || d.createdAt > prev.createdAt) byType.set(d.type, d);
  }
  return [...byType.values()];
}

// ---------- registry check --------------------------------------------------------------------

const REGISTRY_ROWS = [
  { key: 'name', label: '상호' },
  { key: 'representativeName', label: '대표자' },
  { key: 'registrationNumber', label: '등록번호' },
  { key: 'roadAddress', label: '소재지' },
] as const;

function RegistryPanel({ agency }: { agency: AdminAgencyDetail }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const recheck = useMutation({
    mutationFn: () => recheckAgencyRegistry(agency.id),
    onSuccess: (result) => {
      toast(`등록 정보를 다시 조회했어요 · ${REGISTRY_STATUS_META[result.status].label}`);
      queryClient.setQueryData(modKeys.agencyRegistry(agency.id), result);
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies', 'list'] });
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
  });
  const check: RegistryCheck | null | undefined = agency.registryCheck;
  const meta = check ? REGISTRY_STATUS_META[check.status] : null;
  const applied: Record<(typeof REGISTRY_ROWS)[number]['key'], string> = {
    name: agency.name,
    representativeName: agency.representativeName,
    registrationNumber: agency.registrationNumber,
    roadAddress: fullAddress(agency),
  };

  return (
    <Panel
      title="등록 조회 결과"
      description={check?.source ?? '국가공간정보 중개업소 조회'}
      actions={
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Icon name="refresh" size={16} />}
          loading={recheck.isPending}
          onClick={() => recheck.mutate()}
        >
          다시 조회
        </Button>
      }
    >
      {!check || !meta ? (
        <Callout size="sm" tone="muted">
          아직 등록 정보를 조회하지 않았어요. <strong>다시 조회</strong>를 눌러 등록번호를 대조해
          주세요.
        </Callout>
      ) : (
        <>
          <div className={a.regHead}>
            <div className={a.regSummary}>
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <span>{formatDateTime(check.checkedAt)} 조회</span>
              {check.registry?.businessStatus && (
                <span>
                  영업 상태{' '}
                  <strong className={s.cellStrong}>{check.registry.businessStatus}</strong>
                </span>
              )}
              {check.registry?.registeredAt && (
                <span>등록일 {formatDate(check.registry.registeredAt)}</span>
              )}
            </div>
          </div>
          {check.message && (
            <Callout
              size="sm"
              tone={
                check.status === 'NOT_FOUND'
                  ? 'danger'
                  : check.status === 'MATCHED'
                    ? 'info'
                    : 'warn'
              }
              className={a.regMessage}
            >
              {check.message}
            </Callout>
          )}
          {check.registry && (
            <div className={a.regTableWrap}>
              <table className={a.regTable}>
                <caption className="sr-only">신청 내용과 등록 정보 비교</caption>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">신청 내용</th>
                    <th scope="col">등록 정보</th>
                    <th scope="col" className={a.regMark}>
                      대조
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {REGISTRY_ROWS.map((row) => {
                    const mismatch = check.mismatches.includes(row.key);
                    return (
                      <tr key={row.key} className={mismatch ? a.regMismatch : undefined}>
                        <th scope="row">{row.label}</th>
                        <td data-label="신청">{applied[row.key]}</td>
                        <td data-label="등록">{check.registry?.[row.key] ?? '–'}</td>
                        <td className={a.regMark}>
                          <span className={cx(s.inlineIcon, mismatch ? s.warnText : s.okText)}>
                            <Icon name={mismatch ? 'alert' : 'check-circle'} size={16} />
                            {mismatch ? '불일치' : '일치'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------- documents -------------------------------------------------------------------------

function DocumentsPanel({
  agency,
  onOpen,
}: {
  agency: AdminAgencyDetail;
  onOpen: (doc: AdminAgencyDocument) => void;
}) {
  const docs = latestDocuments(agency.documents);
  const missing = REQUIRED_AGENCY_DOCUMENTS.filter((t) => !docs.some((d) => d.type === t));
  return (
    <Panel
      title="제출 서류"
      count={docs.length}
      description="비공개 파일 · 권한이 있는 관리자만 열람할 수 있어요"
    >
      <ul className={a.docs} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {docs.map((d) => (
          <li key={d.id} className={a.doc}>
            <span className={a.docIcon}>
              <Icon name="document" size={22} />
            </span>
            <span className={a.docText}>
              <span className={a.docType}>
                {d.type === AgencyDocumentType.OTHER
                  ? '공제증서 등 기타'
                  : AGENCY_DOCUMENT_TYPE_LABEL[d.type]}
                {REQUIRED_AGENCY_DOCUMENTS.includes(d.type) && <em>필수</em>}
              </span>
              <span className={a.docFile}>
                {[d.fileName, d.sizeBytes ? formatBytes(d.sizeBytes) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<Icon name="eye" size={16} />}
              onClick={() => onOpen(d)}
              aria-label={`${AGENCY_DOCUMENT_TYPE_LABEL[d.type]} 보기`}
            >
              보기
            </Button>
          </li>
        ))}
        {missing.map((t) => (
          <li key={t} className={cx(a.doc, a.docMissing)}>
            <span className={a.docIcon}>
              <Icon name="alert" size={22} />
            </span>
            <span className={a.docText}>
              <span className={a.docType}>
                {AGENCY_DOCUMENT_TYPE_LABEL[t]}
                <em>필수</em>
              </span>
              <span className={cx(a.docFile, s.warnText)}>제출되지 않았어요</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------- decision --------------------------------------------------------------------------

function Checklist({ agency }: { agency: AdminAgencyDetail }) {
  const docs = documentSummary(agency.documentTypes ?? []);
  const registry = agency.registryCheck?.status;
  const items = [
    { ok: docs.complete, text: docs.complete ? '필수 서류 2종이 제출됐어요' : docs.label },
    {
      ok: registry === 'MATCHED',
      text:
        registry === 'MATCHED'
          ? '등록 정보가 신청 내용과 일치해요'
          : registry
            ? `등록 조회: ${REGISTRY_STATUS_META[registry].label}`
            : '등록 정보를 아직 조회하지 않았어요',
    },
    {
      ok: !!agency.businessNumber,
      text: agency.businessNumber ? '사업자등록번호가 입력됐어요' : '사업자등록번호가 없어요',
    },
  ];
  return (
    <ul className={a.checks} aria-label="심사 확인 항목">
      {items.map((it) => (
        <li key={it.text} className={cx(a.check, it.ok ? a.checkOk : a.checkWarn)}>
          <Icon name={it.ok ? 'check-circle' : 'alert'} size={16} />
          {it.text}
        </li>
      ))}
    </ul>
  );
}

const DIALOG: Record<
  Exclude<Decision, 'approve' | 'restore' | 'override'>,
  { title: string; description: string; label: string; presets: readonly string[]; confirm: string }
> = {
  reject: {
    title: '신청 반려',
    description:
      '반려 사유는 신청자에게 그대로 전달돼요. 무엇을 고쳐 다시 신청하면 되는지 알려 주세요.',
    label: '반려 사유',
    presets: AGENCY_REJECT_PRESETS,
    confirm: '반려',
  },
  suspend: {
    title: '이용 정지',
    description:
      '정지하면 이 사무소의 광고 매물이 모두 사이트에서 내려가고, 소속 중개사는 중개사 콘솔을 쓸 수 없어요.',
    label: '정지 사유',
    presets: AGENCY_SUSPEND_PRESETS,
    confirm: '이용 정지',
  },
};

/** 중개사무소 심사 / 상세 (`/agencies/[id]`). */
export function AgencyDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Decision | null>(null);
  const [viewing, setViewing] = useState<AdminAgencyDocument | null>(null);

  const {
    data: detail,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: modKeys.agency(id),
    queryFn: ({ signal }) => fetchAgency(id, signal),
  });
  // The registry lookup is its own endpoint (GET …/registry-check); merged into the detail so the
  // panels and the approval checks read one object. A failed lookup reads as "조회 전".
  const registry = useQuery({
    queryKey: modKeys.agencyRegistry(id),
    queryFn: ({ signal }) => fetchAgencyRegistry(id, signal),
    enabled: !!detail,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const agency = useMemo(() => withRegistry(detail, registry.data), [detail, registry.data]);

  const decision = useMutation({
    mutationFn: (v: { status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; reason?: string }) =>
      decideAgency(id, v),
    onSuccess: (next, v) => {
      queryClient.setQueryData(modKeys.agency(id), next);
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
      toast(
        v.status === 'APPROVED'
          ? dialog === 'restore'
            ? '이용 정지를 해제했어요.'
            : '승인했어요. 신청자에게 알림을 보냈어요.'
          : v.status === 'REJECTED'
            ? '신청을 반려했어요. 사유를 신청자에게 전달했어요.'
            : '이용을 정지했어요.',
      );
      setDialog(null);
    },
    onError: (err) => {
      // Reason dialogs (반려 · 정지 · 확인 후 승인) show the error inline; plain confirms toast it.
      if (dialog === 'approve' || dialog === 'restore') {
        toast({ message: errorMessage(err), tone: 'error' });
        setDialog(null);
      }
    },
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !agency)
    return (
      <DetailError
        error={error}
        onRetry={() => void refetch()}
        backHref={ADMIN_ROUTES.agencies}
        backLabel="중개사 목록으로"
        subject="중개사무소"
      />
    );

  const status = AGENCY_STATUS_META[agency.status];
  const pending = agency.status === AgencyStatus.PENDING;
  const days = waitingDays(agency.createdAt);
  const docs = documentSummary(agency.documentTypes ?? []);
  const blocked = !docs.complete || agency.registryCheck?.status !== 'MATCHED';
  const reasonDialog = dialog === 'reject' || dialog === 'suspend' ? DIALOG[dialog] : null;
  const registryLabel = agency.registryCheck
    ? REGISTRY_STATUS_META[agency.registryCheck.status].label
    : '조회 전';
  const unverified = [
    docs.complete ? null : docs.label,
    agency.registryCheck?.status === 'MATCHED' ? null : `등록 조회 ${registryLabel}`,
  ].filter(Boolean);
  /** A clean application is approved in one click; anything else needs a written check. */
  const startApprove = () => {
    decision.reset();
    setDialog(blocked ? 'override' : 'approve');
  };

  return (
    <div className={s.detail}>
      <AdminPageHeader
        title={pending ? '중개사무소 심사' : '중개사무소 상세'}
        crumb={['매물 · 회원', { label: '중개사 관리', href: ADMIN_ROUTES.agencies }]}
      />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.agencies}>
        중개사 목록
      </BackLink>

      <DetailHero
        icon={<Icon name="store" size={24} />}
        eyebrow={
          <>
            등록번호 <span className={s.num}>{agency.registrationNumber}</span>
          </>
        }
        title={agency.name}
        badges={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
        meta={
          <>
            <span>
              <Icon name="user" size={14} />
              대표 {agency.representativeName}
            </span>
            <span>
              <Icon name="map-pin" size={14} />
              {agency.emdName ?? agency.roadAddress}
            </span>
            <span>
              <Icon name="calendar" size={14} />
              {formatDate(agency.createdAt)} 신청
              {pending && (
                <strong className={days >= 3 ? s.warnText : undefined}>
                  &nbsp;· {waitingLabel(days)}
                </strong>
              )}
            </span>
          </>
        }
        aside={
          agency.status === AgencyStatus.APPROVED ? (
            <Button
              size="sm"
              variant="secondary"
              href={`${env.siteUrl}/agency/${agency.id}`}
              target="_blank"
              rel="noopener"
              iconRight={<Icon name="external-link" size={16} />}
            >
              사이트에서 보기
            </Button>
          ) : undefined
        }
      />

      <AuditNotice subject="신청자 개인정보와 비공개 서류" />

      <DetailGrid
        main={
          <>
            <Panel title="신청 정보">
              <InfoList
                items={[
                  { label: '상호', value: agency.name },
                  { label: '대표자', value: agency.representativeName },
                  {
                    label: '등록번호',
                    value: <span className={s.num}>{agency.registrationNumber}</span>,
                  },
                  {
                    label: '사업자번호',
                    value: agency.businessNumber ? (
                      <span className={s.num}>{formatBusinessNumber(agency.businessNumber)}</span>
                    ) : null,
                  },
                  {
                    label: '대표번호',
                    value: agency.phone ? (
                      <span className={s.num}>{formatPhone(agency.phone)}</span>
                    ) : null,
                  },
                  {
                    label: '휴대전화',
                    value: agency.mobile ? (
                      <span className={s.num}>{formatPhone(agency.mobile)}</span>
                    ) : null,
                  },
                  { label: '이메일', value: agency.email },
                  {
                    label: '전문 분야',
                    value:
                      agency.specialties.length > 0 ? (
                        <span className={s.tagRow}>
                          {agency.specialties.map((t) => (
                            <Tag key={t}>{ASSET_TYPE_LABEL[t]}</Tag>
                          ))}
                        </span>
                      ) : null,
                  },
                  {
                    label: '소재지',
                    wide: true,
                    value: (
                      <>
                        {fullAddress(agency)}
                        {agency.zipCode && (
                          <span className={s.mutedText}> (우 {agency.zipCode})</span>
                        )}
                      </>
                    ),
                  },
                  { label: '소개', wide: true, value: agency.intro },
                ]}
              />
            </Panel>

            <RegistryPanel agency={agency} />
            <DocumentsPanel agency={agency} onOpen={setViewing} />

            {agency.owner && (
              <Panel
                title="신청자 계정"
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    href={`${ADMIN_ROUTES.users}/${agency.owner.id}`}
                    linkAs={Link}
                    iconRight={<Icon name="chevron-right" size={16} />}
                  >
                    회원 정보
                  </Button>
                }
              >
                <InfoList
                  items={[
                    { label: '이름', value: agency.owner.name },
                    { label: '닉네임', value: agency.owner.nickname },
                    { label: '이메일', value: agency.owner.email },
                    {
                      label: '연락처',
                      value: agency.owner.phone ? (
                        <span className={s.num}>{formatPhone(agency.owner.phone)}</span>
                      ) : null,
                    },
                    {
                      label: '가입일',
                      value: agency.owner.createdAt ? formatDate(agency.owner.createdAt) : null,
                    },
                    {
                      label: '로그인 수단',
                      value: agency.owner.providers.map((p) => AUTH_PROVIDER_LABEL[p]).join(' · '),
                    },
                  ]}
                />
              </Panel>
            )}

            {!pending && agency.members.length > 0 && (
              <Panel title="소속 구성원" count={agency.members.length} flush>
                <ul className={s.rows}>
                  {agency.members.map((m) => (
                    <li key={m.id} className={s.row}>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{m.displayName}</span>
                        <span className={s.rowSub}>
                          {[m.title, m.joinedAt ? `${formatDate(m.joinedAt)} 합류` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className={s.rowSide}>
                        {m.isLicensed && <Badge tone="brand">공인중개사</Badge>}
                        {m.role === 'OWNER' && <Badge tone="ink">대표</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </>
        }
        side={
          <>
            <Panel title={pending ? '심사' : '상태 관리'}>
              <div className={s.sideStatus}>
                <span>현재 상태</span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
              {agency.statusReason && agency.status !== AgencyStatus.APPROVED && (
                <p className={a.reasonBox}>
                  <strong>
                    {agency.status === AgencyStatus.REJECTED ? '반려 사유' : '정지 사유'}
                  </strong>
                  {agency.statusReason}
                </p>
              )}
              {pending && (
                <>
                  <Checklist agency={agency} />
                  <div className={s.actions}>
                    <div className={s.actionsRow}>
                      <Button variant="danger" onClick={() => setDialog('reject')}>
                        반려
                      </Button>
                      <Button onClick={startApprove}>{blocked ? '확인 후 승인' : '승인'}</Button>
                    </div>
                    <p className={s.actionHint}>
                      {blocked
                        ? '자동 확인이 안 된 항목이 있어요. 직접 확인한 방법을 남겨야 승인할 수 있고, 작업 기록에 남아요.'
                        : '승인하면 대표 계정이 개업공인중개사 권한을 받고 매물을 등록할 수 있어요.'}
                    </p>
                  </div>
                </>
              )}
              {agency.status === AgencyStatus.APPROVED && (
                <div className={s.actions}>
                  <Button variant="danger" block onClick={() => setDialog('suspend')}>
                    이용 정지
                  </Button>
                  <p className={s.actionHint}>
                    정지하면 광고 중인 매물 {formatCount(agency.activeListingCount ?? 0)}건이
                    사이트에서 내려가요.
                  </p>
                </div>
              )}
              {agency.status === AgencyStatus.SUSPENDED && (
                <div className={s.actions}>
                  <Button block onClick={() => setDialog('restore')}>
                    정지 해제
                  </Button>
                  <p className={s.actionHint}>해제하면 다시 매물을 광고할 수 있어요.</p>
                </div>
              )}
              {agency.status === AgencyStatus.REJECTED && (
                <div className={s.actions}>
                  <Button variant="secondary" block onClick={startApprove}>
                    반려 취소하고 승인
                  </Button>
                  <p className={s.actionHint}>
                    신청자가 서류를 보완했다면 내용을 확인한 뒤 승인할 수 있어요.
                  </p>
                </div>
              )}
            </Panel>

            {!pending && (
              <Panel title="활동">
                <MiniStats
                  items={[
                    {
                      label: '광고 매물',
                      value: formatCount(agency.activeListingCount ?? 0),
                      unit: '건',
                    },
                    { label: '프로필 조회', value: formatCount(agency.viewCount) },
                    { label: '누적 경고', value: agency.warningCount, unit: '회' },
                  ]}
                />
              </Panel>
            )}

            {agency.warnings.length > 0 && (
              <Panel title="경고 이력" count={agency.warnings.length}>
                <Timeline
                  label="경고 이력"
                  items={agency.warnings.map((w) => ({
                    id: w.id,
                    tone: 'warn',
                    title: w.reason,
                    meta: [w.adminName, formatDateTime(w.createdAt)].filter(Boolean).join(' · '),
                    note: w.reportId ? (
                      <Link href={`${ADMIN_ROUTES.reports}/${w.reportId}`} className="link">
                        연결된 신고 보기
                      </Link>
                    ) : undefined,
                  }))}
                />
              </Panel>
            )}

            <Panel title="처리 이력">
              <Timeline
                label="상태 변경 이력"
                items={agency.statusHistory.map((h) => ({
                  id: h.id,
                  tone:
                    h.toStatus === 'APPROVED'
                      ? 'success'
                      : h.toStatus === 'PENDING'
                        ? 'brand'
                        : 'danger',
                  title:
                    h.toStatus === 'PENDING'
                      ? '입점 신청'
                      : h.toStatus === 'APPROVED'
                        ? h.fromStatus === 'SUSPENDED'
                          ? '정지 해제'
                          : '승인'
                        : AGENCY_STATUS_META[h.toStatus].label,
                  meta: [h.decidedByName, formatDateTime(h.createdAt)].filter(Boolean).join(' · '),
                  note: h.reason ?? undefined,
                }))}
              />
            </Panel>
          </>
        }
      />

      <ConfirmDialog
        open={dialog === 'approve' || dialog === 'restore'}
        onClose={() => setDialog(null)}
        onConfirm={() => decision.mutate({ status: 'APPROVED' })}
        title={dialog === 'restore' ? '이용 정지를 해제할까요?' : '이 중개사무소를 승인할까요?'}
        description={
          dialog === 'restore'
            ? `${agency.name}이(가) 다시 매물을 광고하고 중개사 콘솔을 쓸 수 있게 돼요.`
            : `${agency.name} (대표 ${agency.representativeName})을(를) 승인하면 대표 계정이 개업공인중개사 권한을 받아요.`
        }
        confirmLabel={dialog === 'restore' ? '정지 해제' : '승인'}
        loading={decision.isPending}
      />
      <ReasonDialog
        open={dialog === 'override'}
        onClose={() => {
          setDialog(null);
          decision.reset();
        }}
        title="확인 후 승인"
        description={`자동 확인이 끝나지 않은 신청이에요 (${unverified.join(', ')}). 서류 원본이나 관할 관청을 통해 직접 확인한 방법을 남겨 주세요. 승인 기록과 함께 작업 기록에 남아요.`}
        target={{
          title: agency.name,
          sub: `대표 ${agency.representativeName} · ${agency.registrationNumber}`,
        }}
        reasonLabel="확인한 방법"
        placeholder="무엇을 어떻게 확인했는지 적어 주세요."
        presets={AGENCY_APPROVE_OVERRIDE_PRESETS}
        maxLength={1000}
        confirmLabel="승인"
        loading={decision.isPending}
        error={decision.isError && dialog === 'override' ? errorMessage(decision.error) : null}
        onConfirm={(reason) => decision.mutate({ status: 'APPROVED', reason })}
      />
      {reasonDialog && (
        <ReasonDialog
          open
          onClose={() => {
            setDialog(null);
            decision.reset();
          }}
          title={reasonDialog.title}
          description={reasonDialog.description}
          target={{
            title: agency.name,
            sub: `대표 ${agency.representativeName} · ${agency.registrationNumber}`,
          }}
          reasonLabel={reasonDialog.label}
          presets={reasonDialog.presets}
          maxLength={1000}
          confirmLabel={reasonDialog.confirm}
          danger
          loading={decision.isPending}
          error={decision.isError ? errorMessage(decision.error) : null}
          onConfirm={(reason) =>
            decision.mutate({ status: dialog === 'reject' ? 'REJECTED' : 'SUSPENDED', reason })
          }
        />
      )}
      <DocumentViewer
        agencyId={agency.id}
        agencyName={agency.name}
        document={viewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
