'use client';
import {
  AdminRole,
  AgencySiteDecisionAction,
  AgencySiteStatus,
  AgencyStatus,
  agencySiteCssVars,
  agencySitePalette,
} from '@house/shared';
import {
  Badge,
  Button,
  Callout,
  ErrorState,
  Icon,
  Panel,
  Skeleton,
  StatusPill,
  cx,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { env } from '@/config/env';
import { useAdminSession } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/format';
import { fetchAgencySite, modKeys } from '../api/queries';
import type { AdminAgencyDetail, AgencySite } from '../api/schemas';
import {
  AGENCY_SITE_STATUS_META,
  siteHost,
  siteSlugOf,
  siteVisibility,
  waitingDays,
  waitingLabel,
} from '../lib/labels';
import { InfoList } from '../ui/Detail';
import s from '../ui/ui.module.css';
import { SiteDecisionDialog, type SiteIntent } from './SiteDecision';
import st from './site.module.css';

/** Swatch + palette name of a brand colour ("■ 초록"). */
export function ColorSwatch({ color }: { color: string }) {
  const palette = agencySitePalette(color);
  return (
    <span className={st.swatch} style={{ '--swatch': palette.brand } as CSSProperties}>
      {palette.label}
    </span>
  );
}

/**
 * The office site's header as visitors see it, painted with the chosen brand colour. Decorative:
 * the colour and the 한 줄 소개 are also listed as text right below.
 */
function SitePreview({ site, agencyName }: { site: AgencySite; agencyName: string }) {
  return (
    <div className={st.preview} style={agencySiteCssVars(site.color)} aria-hidden="true">
      <div className={st.previewBar}>
        <span className={st.previewMark}>{agencyName.trim().charAt(0)}</span>
        <span className={st.previewName}>{agencyName}</span>
      </div>
      <div className={st.previewBody}>
        <span className={cx(st.previewTagline, !site.tagline && st.empty)}>
          {site.tagline ?? '한 줄 소개를 아직 쓰지 않았어요'}
        </span>
        <span className={st.previewCta}>문의하기</span>
      </div>
    </div>
  );
}

/** "sindae.suncheonmap.kr" with an external link once the API has a URL (ACTIVE). */
function SiteAddress({ site }: { site: AgencySite }) {
  const slug = siteSlugOf(site);
  if (!slug) return null;
  const host = siteHost(slug, env.siteRootDomain);
  const label =
    site.status === AgencySiteStatus.REQUESTED
      ? '신청한 주소'
      : site.status === AgencySiteStatus.REJECTED
        ? '신청했던 주소'
        : '홈페이지 주소';
  return (
    <div className={st.address}>
      <span className={st.addressLabel}>{label}</span>
      {site.url ? (
        <a className={st.host} href={site.url} target="_blank" rel="noopener noreferrer">
          {host}
          <Icon name="external-link" size={14} />
          <span className="sr-only">(새 창)</span>
        </a>
      ) : (
        <span className={st.host}>{host}</span>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div aria-busy="true" aria-label="홈페이지 정보를 불러오는 중" className={s.actions}>
      <Skeleton height={14} width="40%" />
      <Skeleton height={18} width="70%" />
      <Skeleton height={96} radius={12} />
      <Skeleton height={40} radius={10} />
    </div>
  );
}

/**
 * 사무소 홈페이지 (`<slug>.<root>`) of one office on the agency detail: request / approved address,
 * brand colour + 한 줄 소개 preview, and the admin decisions — 승인 (the slug may be corrected), 반려,
 * 정지 (reason), 정지 해제. 승인 / 반려 are OPERATOR work; 정지 / 정지 해제 need ADMIN or higher
 * (the API's minRoleForSiteDecision), so operators only read them.
 */
export function AgencySitePanel({ agency }: { agency: AdminAgencyDetail }) {
  const { can } = useAdminSession();
  const canSuspend = can(AdminRole.ADMIN);
  const [intent, setIntent] = useState<SiteIntent | null>(null);
  const query = useQuery({
    queryKey: modKeys.agencySite(agency.id),
    queryFn: ({ signal }) => fetchAgencySite(agency.id, signal),
  });
  const site = query.data?.site ?? null;
  const open = (action: AgencySiteDecisionAction) => {
    if (!site) return;
    setIntent({
      action,
      site,
      agencyName: agency.name,
      representativeName: agency.representativeName,
    });
  };

  const meta = site ? AGENCY_SITE_STATUS_META[site.status] : null;
  const visibility = site ? siteVisibility(site, agency.status) : null;

  return (
    <Panel
      id="site"
      title="사무소 홈페이지"
      description={site ? undefined : '중개사무소 전용 홈페이지 주소 신청과 운영 상태'}
    >
      {query.isPending ? (
        <PanelSkeleton />
      ) : query.isError ? (
        <ErrorState
          compact
          title="홈페이지 정보를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => void query.refetch()}
        />
      ) : !site || !meta ? (
        <Callout size="sm" tone="muted">
          아직 홈페이지를 신청하지 않았어요. 대표가 중개사 콘솔의 <strong>내 홈페이지</strong>에서
          주소를 신청하면 이곳에서 승인할 수 있어요.
        </Callout>
      ) : (
        <>
          <div className={s.sideStatus}>
            <span>현재 상태</span>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          <SiteAddress site={site} />
          {visibility && (
            <p className={st.visibility}>
              <Badge tone={visibility.tone}>{visibility.label}</Badge>
              {visibility.detail}
            </p>
          )}
          <SitePreview site={site} agencyName={agency.name} />
          <InfoList
            columns={1}
            items={[
              { label: '브랜드 색상', value: <ColorSwatch color={site.color} /> },
              { label: '한 줄 소개', value: site.tagline },
              {
                label: '신청일',
                value: (
                  <>
                    {formatDate(site.requestedAt)}
                    {site.status === AgencySiteStatus.REQUESTED && (
                      <span
                        className={waitingDays(site.requestedAt) >= 3 ? s.warnText : s.mutedText}
                      >
                        {' '}
                        · {waitingLabel(waitingDays(site.requestedAt))}
                      </span>
                    )}
                  </>
                ),
              },
              {
                label: '처리일',
                value: site.decidedAt ? formatDateTime(site.decidedAt) : null,
              },
            ]}
          />
          {site.decisionReason &&
            (site.status === AgencySiteStatus.REJECTED ||
              site.status === AgencySiteStatus.SUSPENDED) && (
              <p className={cx(s.reasonBox, st.reason)}>
                <strong>
                  {site.status === AgencySiteStatus.REJECTED ? '반려 사유' : '정지 사유'}
                </strong>
                {site.decisionReason}
              </p>
            )}

          {site.status === AgencySiteStatus.REQUESTED && (
            <div className={cx(s.actions, st.decision)}>
              <div className={s.actionsRow}>
                <Button variant="danger" onClick={() => open(AgencySiteDecisionAction.REJECT)}>
                  반려
                </Button>
                <Button onClick={() => open(AgencySiteDecisionAction.APPROVE)}>승인</Button>
              </div>
              <p className={s.actionHint}>
                {agency.status === AgencyStatus.APPROVED
                  ? '주소가 상호와 맞는지, 오해를 살 단어가 없는지 확인해 주세요. 필요하면 주소를 고쳐서 승인할 수 있어요.'
                  : '중개사무소가 승인 상태가 아니라서, 승인해도 홈페이지는 사무소가 다시 승인될 때까지 열리지 않아요.'}
              </p>
            </div>
          )}
          {!canSuspend &&
            (site.status === AgencySiteStatus.ACTIVE ||
              site.status === AgencySiteStatus.SUSPENDED) && (
              <p className={cx(s.actionHint, st.decision)}>
                {site.status === AgencySiteStatus.ACTIVE ? '홈페이지 정지' : '정지 해제'}는 관리자
                이상 권한에서 할 수 있어요.
              </p>
            )}
          {canSuspend && site.status === AgencySiteStatus.ACTIVE && (
            <div className={cx(s.actions, st.decision)}>
              <Button variant="danger" block onClick={() => open(AgencySiteDecisionAction.SUSPEND)}>
                홈페이지 정지
              </Button>
              <p className={s.actionHint}>
                정지해도 주소는 이 사무소 몫으로 남아요. 메인 사이트의 사무소 정보와 매물은
                그대로예요.
              </p>
            </div>
          )}
          {canSuspend && site.status === AgencySiteStatus.SUSPENDED && (
            <div className={cx(s.actions, st.decision)}>
              <Button block onClick={() => open(AgencySiteDecisionAction.RESUME)}>
                정지 해제
              </Button>
              <p className={s.actionHint}>해제하면 같은 주소로 홈페이지가 다시 열려요.</p>
            </div>
          )}
          {site.status === AgencySiteStatus.REJECTED && (
            <p className={cx(s.actionHint, st.decision)}>
              중개사무소가 주소를 고쳐 다시 신청하면 승인 대기 목록에 다시 올라와요.
            </p>
          )}
        </>
      )}
      <SiteDecisionDialog intent={intent} onClose={() => setIntent(null)} />
    </Panel>
  );
}
