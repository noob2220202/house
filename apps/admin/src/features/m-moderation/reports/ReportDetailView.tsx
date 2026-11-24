'use client';
import {
  AGENCY_STATUS_LABEL,
  REPORT_REASON_LABEL,
  ReportStatus,
  ReportTargetType,
} from '@house/shared';
import {
  BackLink,
  Badge,
  Button,
  Checkbox,
  DealBadge,
  Icon,
  Panel,
  PhotoPlaceholder,
  StatusPill,
  Textarea,
  dealKindOf,
  photoKindForAsset,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { env } from '@/config/env';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatPhone, formatRelativeTime } from '@/lib/format';
import { EvidenceGallery } from './EvidenceGallery';
import r from './reports.module.css';
import { fetchReport, modKeys, resolveReport, saveReportNote } from '../api/queries';
import type { AdminReportDetail } from '../api/schemas';
import {
  LISTING_STATUS_META,
  REPORT_ACTION_LABEL,
  REPORT_STATUS_META,
  listingName,
  listingPrice,
  listingSpec,
  reportActionOf,
  reportSlaLabel,
  reportTargetTitle,
  shortId,
} from '../lib/labels';
import { REPORT_REJECT_PRESETS, REPORT_RESOLVE_PRESETS } from '../lib/reasons';
import {
  AuditNotice,
  DetailError,
  DetailGrid,
  DetailHero,
  DetailSkeleton,
  InfoList,
  Timeline,
} from '../ui/Detail';
import { MediaImage } from '../ui/MediaImage';
import { ReasonDialog } from '../ui/ReasonDialog';
import s from '../ui/ui.module.css';

type Dialog = 'resolve' | 'reject' | null;
type ResolveInput = Parameters<typeof resolveReport>[1];

const NOTE_MAX = 2000;

// ---------- reported target -------------------------------------------------------------------

function TargetListingPanel({ report }: { report: AdminReportDetail }) {
  const listing = report.listing;
  if (!listing)
    return (
      <Panel title="신고 대상 매물">
        <p className={s.actionHint}>삭제되었거나 더 이상 조회할 수 없는 매물이에요.</p>
      </Panel>
    );
  const name = listingName(listing);
  const status = listing.status ? LISTING_STATUS_META[listing.status] : null;
  const live = listing.status === 'ACTIVE' || listing.status === 'RESERVED';
  return (
    <Panel title="신고 대상 매물" description="현재 광고 내용 기준">
      <div className={r.target}>
        <div className={r.targetThumb}>
          {listing.coverUrl ? (
            <MediaImage src={listing.coverUrl} alt={`${name} 대표 사진`} sizes="120px" />
          ) : (
            <PhotoPlaceholder kind={photoKindForAsset(listing.assetType ?? 'APT')} />
          )}
        </div>
        <div className={r.targetBody}>
          <div className={r.targetTitleRow}>
            <Link href={`${ADMIN_ROUTES.listings}/${listing.id}`} className={r.targetTitle}>
              {name}
            </Link>
            {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
          </div>
          <div className={r.targetPrice}>
            <DealBadge deal={dealKindOf(listing.dealType)} />
            <strong>{listingPrice(listing)}</strong>
          </div>
          <div className={r.targetFacts}>
            <span>{[listing.emdName, listingSpec(listing)].filter(Boolean).join(' · ')}</span>
            <span>
              실매물 확인{' '}
              {listing.verifiedAt ? (
                formatDate(listing.verifiedAt)
              ) : (
                <span className={s.warnText}>미확인</span>
              )}
            </span>
            {listing.publishedAt && <span>{formatDate(listing.publishedAt)} 광고 시작</span>}
            {listing.photoCount != null && <span>사진 {listing.photoCount}장</span>}
          </div>
        </div>
      </div>
      <div className={r.targetActions}>
        <Button
          size="sm"
          variant="secondary"
          href={`${ADMIN_ROUTES.listings}/${listing.id}`}
          linkAs={Link}
          iconRight={<Icon name="chevron-right" size={16} />}
        >
          매물 검수 화면
        </Button>
        {live && (
          <Button
            size="sm"
            variant="ghost"
            href={`${env.siteUrl}/listing/${listing.id}`}
            target="_blank"
            rel="noopener"
            iconRight={<Icon name="external-link" size={16} />}
          >
            사이트에서 보기
          </Button>
        )}
      </div>
    </Panel>
  );
}

function TargetAgencyPanel({ report }: { report: AdminReportDetail }) {
  const agency = report.agency;
  if (!agency) return null;
  const warnings = agency.warningCount ?? 0;
  return (
    <Panel
      title={
        report.targetType === ReportTargetType.AGENCY ? '신고 대상 중개사무소' : '대표 중개사무소'
      }
      actions={
        <Button
          size="sm"
          variant="ghost"
          href={`${ADMIN_ROUTES.agencies}/${agency.id}`}
          linkAs={Link}
          iconRight={<Icon name="chevron-right" size={16} />}
        >
          중개사무소 상세
        </Button>
      }
    >
      <InfoList
        items={[
          { label: '상호', value: agency.name },
          { label: '대표자', value: agency.representativeName },
          {
            label: '대표번호',
            value: agency.phone ? <span className={s.num}>{formatPhone(agency.phone)}</span> : null,
          },
          {
            label: '누적 경고',
            value: (
              <span
                className={warnings >= 2 ? s.dangerText : warnings > 0 ? s.warnText : undefined}
              >
                {warnings}회
              </span>
            ),
          },
          { label: '상태', value: agency.status ? AGENCY_STATUS_LABEL[agency.status] : null },
        ]}
      />
    </Panel>
  );
}

// ---------- internal memo ---------------------------------------------------------------------

function MemoPanel({ report }: { report: AdminReportDetail }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saved = report.internalNote ?? '';
  const [draft, setDraft] = useState(saved);
  // Follow server-side changes (another admin's save, a refetch) to the saved memo.
  const [base, setBase] = useState(saved);
  useEffect(() => {
    if (saved !== base) {
      setBase(saved);
      setDraft(saved);
    }
  }, [saved, base]);

  const save = useMutation({
    mutationFn: () => saveReportNote(report.id, draft.trim()),
    onSuccess: (next) => {
      queryClient.setQueryData(modKeys.report(report.id), next);
      toast('메모를 저장했어요.');
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
  });
  const dirty = draft.trim() !== saved.trim();

  return (
    <Panel title="내부 메모" description="신고자·중개사무소에는 전달되지 않아요">
      <form
        className={r.memo}
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !save.isPending) save.mutate();
        }}
      >
        <Textarea
          aria-label="내부 메모"
          rows={4}
          maxLength={NOTE_MAX}
          placeholder="확인한 내용, 중개사무소와 통화한 내용, 다음에 할 일을 남겨 주세요."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className={r.memoFoot}>
          <span className={r.memoHint}>
            {draft.length.toLocaleString('ko-KR')}/{NOTE_MAX.toLocaleString('ko-KR')}
          </span>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!dirty}
            loading={save.isPending}
          >
            메모 저장
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------- page ------------------------------------------------------------------------------

/** 신고 처리 (`/reports/[id]`): what was reported, evidence, the target, and the resolution. */
export function ReportDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [hide, setHide] = useState(false);
  const [warn, setWarn] = useState(false);

  const {
    data: report,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: modKeys.report(id),
    queryFn: ({ signal }) => fetchReport(id, signal),
  });

  const resolve = useMutation({
    mutationFn: (body: ResolveInput) => resolveReport(id, body),
    onSuccess: (next, body) => {
      queryClient.setQueryData(modKeys.report(id), next);
      // A resolution can hide the listing and warn the office — refresh those screens too.
      for (const key of ['admin-reports', 'admin-listings', 'admin-agencies'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      toast(
        body.status === ReportStatus.IN_REVIEW
          ? '검토 중으로 바꿨어요.'
          : body.status === ReportStatus.REJECTED
            ? '신고를 기각했어요. 신고자에게 결과를 알렸어요.'
            : `조치를 마쳤어요 · ${REPORT_ACTION_LABEL[body.action ?? 'NONE']}`,
      );
      setDialog(null);
    },
    onError: (err) => {
      // Dialog errors are shown inline; the one-click "검토 시작" reports through a toast.
      if (!dialog) toast({ message: errorMessage(err), tone: 'error' });
    },
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !report)
    return (
      <DetailError
        error={error}
        onRetry={() => void refetch()}
        backHref={ADMIN_ROUTES.reports}
        backLabel="신고 목록으로"
        subject="신고"
      />
    );

  const status = REPORT_STATUS_META[report.status];
  const open = report.status === ReportStatus.RECEIVED || report.status === ReportStatus.IN_REVIEW;
  const sla = reportSlaLabel(report.createdAt, report.status);
  const targetTitle = reportTargetTitle(report);
  const listing = report.listing;
  const isListingReport = report.targetType === ReportTargetType.LISTING;
  const canHide =
    isListingReport && !!listing && (listing.status === 'ACTIVE' || listing.status === 'RESERVED');
  const canWarn = !!report.agency;
  const warnings = report.agency?.warningCount ?? 0;

  const openResolve = () => {
    setHide(canHide);
    setWarn(false);
    resolve.reset();
    setDialog('resolve');
  };
  const closeDialog = () => {
    setDialog(null);
    resolve.reset();
  };
  const dialogTarget = {
    title: `${REPORT_REASON_LABEL[report.reason]} · ${targetTitle}`,
    sub: [report.agency?.name, `${formatRelativeTime(report.createdAt)} 접수`]
      .filter(Boolean)
      .join(' · '),
  };

  return (
    <div className={s.detail}>
      <AdminPageHeader
        title="신고 처리"
        crumb={['운영', { label: '신고 관리', href: ADMIN_ROUTES.reports }]}
      />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.reports}>
        신고 목록
      </BackLink>

      <DetailHero
        icon={
          <span className={r.heroIcon}>
            <Icon name="siren" size={24} />
          </span>
        }
        eyebrow={
          <>
            신고 <span className={s.num}>{shortId(report.id)}</span> ·{' '}
            {isListingReport ? '매물 신고' : '중개사무소 신고'}
          </>
        }
        title={REPORT_REASON_LABEL[report.reason]}
        badges={
          <>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {sla && <Badge tone={sla.overdue ? 'danger' : 'neutral'}>{sla.text}</Badge>}
          </>
        }
        meta={
          <>
            <span>
              <Icon name={isListingReport ? 'building' : 'store'} size={14} />
              {targetTitle}
            </span>
            <span>
              <Icon name="clock" size={14} />
              {formatDateTime(report.createdAt)} 접수 ({formatRelativeTime(report.createdAt)})
            </span>
            {report.sameTargetCount > 1 && (
              <span>
                <Icon name="layers" size={14} />
                같은 대상 신고 {report.sameTargetCount}건
              </span>
            )}
          </>
        }
      />

      <AuditNotice subject="신고자 정보와 증빙 자료" />

      <DetailGrid
        main={
          <>
            <Panel title="신고 내용">
              {report.detail ? (
                <p className={s.quote}>{report.detail}</p>
              ) : (
                <p className={s.actionHint}>신고자가 상세 내용을 남기지 않았어요.</p>
              )}
              <div style={{ marginTop: 16 }}>
                <InfoList
                  items={[
                    {
                      label: '신고 사유',
                      value: <Badge tone="danger">{REPORT_REASON_LABEL[report.reason]}</Badge>,
                    },
                    { label: '접수 일시', value: formatDateTime(report.createdAt) },
                    {
                      label: '신고자',
                      value: report.reporter ? (
                        <span className={r.reporter}>
                          <Link
                            href={`${ADMIN_ROUTES.users}/${report.reporter.id}`}
                            className="link"
                          >
                            {report.reporter.nickname ?? '닉네임 없음'}
                          </Link>
                          {report.reporter.reportCount != null && (
                            <span className={s.mutedText}>
                              지금까지 신고 {report.reporter.reportCount}건 · 사실 확인{' '}
                              {report.reporter.upheldCount ?? 0}건
                            </span>
                          )}
                        </span>
                      ) : null,
                    },
                    {
                      label: '신고자 연락처',
                      value: report.reporterPhone ? (
                        <span className={s.num}>{formatPhone(report.reporterPhone)}</span>
                      ) : (
                        <span className={s.mutedText}>남기지 않음</span>
                      ),
                    },
                  ]}
                />
              </div>
            </Panel>

            <Panel title="증빙 자료" count={report.attachments.length}>
              {report.attachments.length > 0 ? (
                <EvidenceGallery items={report.attachments} subject={targetTitle} />
              ) : (
                <p className={s.actionHint}>
                  첨부된 증빙 자료가 없어요. 필요하면 신고자 연락처로 추가 자료를 요청해 주세요.
                </p>
              )}
            </Panel>

            {isListingReport && <TargetListingPanel report={report} />}
            <TargetAgencyPanel report={report} />

            {report.relatedReports.length > 0 && (
              <Panel title="같은 대상의 다른 신고" count={report.relatedReports.length} flush>
                <ul className={s.rows}>
                  {report.relatedReports.map((rel) => (
                    <li key={rel.id} className={s.row}>
                      <span className={s.rowMain}>
                        <Link href={`${ADMIN_ROUTES.reports}/${rel.id}`} className={s.rowTitle}>
                          {REPORT_REASON_LABEL[rel.reason]}
                        </Link>
                        <span className={s.rowSub}>
                          {formatRelativeTime(rel.createdAt)} 접수
                          {rel.action && rel.action !== 'NONE'
                            ? ` · ${REPORT_ACTION_LABEL[rel.action]}`
                            : ''}
                        </span>
                      </span>
                      <span className={s.rowSide}>
                        <StatusPill tone={REPORT_STATUS_META[rel.status].tone}>
                          {REPORT_STATUS_META[rel.status].label}
                        </StatusPill>
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
            <Panel title="처리">
              <div className={s.sideStatus}>
                <span>현재 상태</span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
              {open ? (
                <div className={s.actions}>
                  <Button block onClick={openResolve}>
                    조치하기
                  </Button>
                  <div
                    className={report.status === ReportStatus.RECEIVED ? s.actionsRow : undefined}
                  >
                    {report.status === ReportStatus.RECEIVED && (
                      <Button
                        variant="secondary"
                        block
                        loading={resolve.isPending && !dialog}
                        onClick={() => resolve.mutate({ status: ReportStatus.IN_REVIEW })}
                      >
                        검토 시작
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      block
                      onClick={() => {
                        resolve.reset();
                        setDialog('reject');
                      }}
                    >
                      기각
                    </Button>
                  </div>
                  <p className={s.actionHint}>
                    조치하기에서 <strong>매물 숨김</strong>과 <strong>중개사무소 경고</strong>를
                    고를 수 있어요. 사실이 아니면 기각해 주세요. 결과는 신고자에게 알림으로
                    전달돼요.
                  </p>
                </div>
              ) : (
                <div className={r.result}>
                  <span className={r.resultLabel}>처리 결과</span>
                  <span className={r.resultValue}>
                    {report.status === ReportStatus.REJECTED
                      ? '기각 (조치 없음)'
                      : REPORT_ACTION_LABEL[report.action ?? 'NONE']}
                  </span>
                  {report.resolutionNote && (
                    <span className={r.resultNote}>{report.resolutionNote}</span>
                  )}
                  <span className={r.resultMeta}>
                    {[
                      report.handledByName,
                      report.handledAt ? formatDateTime(report.handledAt) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}
            </Panel>

            <MemoPanel report={report} />

            <Panel title="처리 이력">
              <Timeline
                label="신고 처리 이력"
                items={report.timeline.map((t) => ({
                  id: t.id,
                  tone:
                    t.status === 'RESOLVED'
                      ? 'success'
                      : t.status === 'REJECTED'
                        ? 'danger'
                        : t.status === 'IN_REVIEW'
                          ? 'brand'
                          : 'default',
                  title: t.status
                    ? t.status === 'RECEIVED'
                      ? '신고 접수'
                      : t.status === 'IN_REVIEW'
                        ? '검토 시작'
                        : REPORT_STATUS_META[t.status].label
                    : '메모 수정',
                  meta: [t.adminName, formatDateTime(t.createdAt)].filter(Boolean).join(' · '),
                  note: t.note ?? undefined,
                }))}
              />
            </Panel>
          </>
        }
      />

      <ReasonDialog
        open={dialog === 'resolve'}
        onClose={closeDialog}
        title="신고 조치"
        description="신고 내용이 사실로 확인됐을 때 진행해 주세요. 선택한 조치는 바로 적용되고 작업 기록에 남아요."
        target={dialogTarget}
        reasonLabel="처리 내용"
        placeholder="무엇을 어떻게 확인했는지 적어 주세요."
        help="처리 결과로 신고자와 중개사무소에 전달돼요. 내부 메모는 전달되지 않아요."
        presets={REPORT_RESOLVE_PRESETS}
        maxLength={NOTE_MAX}
        confirmLabel="조치 완료"
        danger
        confirmDisabled={!hide && !warn}
        loading={resolve.isPending}
        error={resolve.isError && dialog === 'resolve' ? errorMessage(resolve.error) : null}
        onConfirm={(note) =>
          resolve.mutate({
            status: ReportStatus.RESOLVED,
            action: reportActionOf(hide, warn),
            note,
          })
        }
      >
        <fieldset className={r.choices}>
          <legend className={r.choicesLegend}>조치 선택 (하나 이상)</legend>
          <div className={r.choice}>
            <Checkbox
              checked={hide}
              disabled={!canHide}
              onChange={(e) => setHide(e.target.checked)}
            >
              매물 숨김
            </Checkbox>
            <span className={r.choiceHelp}>
              {canHide
                ? '사이트의 지도·목록·상세에서 바로 내려가고, 광고 중인 중개사무소에 사유가 전달돼요.'
                : isListingReport
                  ? '이미 숨김 처리됐거나 종료된 매물이에요.'
                  : '중개사무소 신고에는 선택할 수 없어요.'}
            </span>
          </div>
          <div className={r.choice}>
            <Checkbox
              checked={warn}
              disabled={!canWarn}
              onChange={(e) => setWarn(e.target.checked)}
            >
              중개사무소 경고
            </Checkbox>
            <span className={r.choiceHelp}>
              {report.agency
                ? `${report.agency.name}에 경고 1회가 기록돼요 (현재 누적 ${warnings}회). 3회가 되면 이용 정지를 검토해 주세요.`
                : '연결된 중개사무소가 없어요.'}
            </span>
          </div>
          {!hide && !warn && (
            <span className={r.choiceError} role="status">
              조치를 하나 이상 선택해 주세요. 조치할 내용이 없으면 기각을 사용해 주세요.
            </span>
          )}
        </fieldset>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === 'reject'}
        onClose={closeDialog}
        title="신고 기각"
        description="신고 내용이 사실이 아니거나 확인할 수 없을 때 기각해요. 매물과 중개사무소에는 아무 조치도 하지 않아요."
        target={dialogTarget}
        reasonLabel="기각 사유"
        placeholder="왜 사실이 아닌지 적어 주세요."
        help="기각 사유로 신고자에게 전달돼요. 내부 메모는 전달되지 않아요."
        presets={REPORT_REJECT_PRESETS}
        maxLength={NOTE_MAX}
        confirmLabel="기각"
        danger
        loading={resolve.isPending}
        error={resolve.isError && dialog === 'reject' ? errorMessage(resolve.error) : null}
        onConfirm={(note) =>
          resolve.mutate({ status: ReportStatus.REJECTED, action: 'NONE', note })
        }
      />
    </div>
  );
}
