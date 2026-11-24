'use client';
import {
  ASSET_TYPE_LABEL,
  DIRECTION_LABEL,
  LISTING_OPTION_LABEL,
  ListingStatus,
  MOVE_IN_TYPE_LABEL,
  REPORT_REASON_LABEL,
  VERIFICATION_METHOD_LABEL,
} from '@house/shared';
import {
  BackLink,
  Badge,
  Button,
  Callout,
  DealBadge,
  Icon,
  Panel,
  PhotoPlaceholder,
  PremiumBadge,
  StatusPill,
  Tag,
  dealKindOf,
  photoKindForAsset,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { env } from '@/config/env';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import {
  formatAreaBoth,
  formatCount,
  formatDate,
  formatDateTime,
  formatFloor,
  formatMaintenanceFee,
  formatPhone,
  formatRelativeTime,
} from '@/lib/format';
import l from './listings.module.css';
import { ImageLightbox } from '../reports/EvidenceGallery';
import {
  fetchListing,
  modKeys,
  moderateListing,
  type ListingModerationAction,
} from '../api/queries';
import type { AdminListingDetail } from '../api/schemas';
import {
  LISTING_STATUS_META,
  REPORT_STATUS_META,
  REVIEW_FLAG_LABEL,
  historyLabel,
  isModerationAction,
  listingName,
  listingPrice,
  shortId,
} from '../lib/labels';
import { LISTING_CLOSE_PRESETS, LISTING_HIDE_PRESETS } from '../lib/reasons';
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
import { MediaImage } from '../ui/MediaImage';
import { ReasonDialog } from '../ui/ReasonDialog';
import s from '../ui/ui.module.css';

const ACTION_COPY: Record<
  ListingModerationAction,
  {
    title: string;
    description: string;
    label: string;
    confirm: string;
    presets?: readonly string[];
    required: boolean;
    danger: boolean;
    done: string;
  }
> = {
  hide: {
    title: '매물 숨김',
    description:
      '숨기면 사이트의 지도·목록·상세에서 바로 내려가요. 사유는 광고 중인 모든 중개사무소에 전달돼요.',
    label: '숨김 사유',
    confirm: '숨김 처리',
    presets: LISTING_HIDE_PRESETS,
    required: true,
    danger: true,
    done: '매물을 숨겼어요. 중개사무소에 사유를 전달했어요.',
  },
  unhide: {
    title: '숨김 해제',
    description: '숨김을 해제하면 매물이 다시 광고중 상태로 사이트에 노출돼요.',
    label: '메모 (선택)',
    confirm: '숨김 해제',
    required: false,
    danger: false,
    done: '숨김을 해제했어요. 매물이 다시 노출돼요.',
  },
  close: {
    title: '광고 강제 종료',
    description:
      '광고를 종료(상태: 거래완료)하면 중개사무소가 이 매물을 다시 광고할 수 없어요. 되돌릴 수 없으니 사실 관계를 확인한 뒤 진행해 주세요.',
    label: '종료 사유',
    confirm: '강제 종료',
    presets: LISTING_CLOSE_PRESETS,
    required: true,
    danger: true,
    done: '매물을 종료했어요.',
  },
};

function PhotosPanel({ listing }: { listing: AdminListingDetail }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = listing.photos.slice(0, 8);
  const more = listing.photos.length - shown.length;
  const name = listingName(listing);
  return (
    <Panel
      title="사진"
      count={listing.photoCount}
      description={shown.length > 0 ? '누르면 크게 볼 수 있어요' : undefined}
    >
      {shown.length === 0 ? (
        <div className={l.photos}>
          <div className={l.photo}>
            <PhotoPlaceholder
              kind={photoKindForAsset(listing.assetType)}
              label="등록된 사진 없음"
            />
          </div>
        </div>
      ) : (
        <ul className={l.photos} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((p, i) => {
            const last = i === shown.length - 1 && more > 0;
            return (
              <li key={p.id} className={l.photo}>
                <button
                  type="button"
                  className={l.photoBtn}
                  onClick={() => setViewing(i)}
                  aria-label={`사진 ${i + 1}${p.isCover ? ' (대표)' : ''} 크게 보기${last ? ` · 외 ${more}장` : ''}`}
                >
                  <MediaImage
                    src={p.url}
                    alt=""
                    sizes="(max-width: 720px) 50vw, 200px"
                    priority={i === 0}
                  />
                </button>
                {p.isCover && (
                  <span className={l.photoTag}>
                    <Badge tone="ink">대표</Badge>
                  </span>
                )}
                {last && (
                  <span className={l.photoMore} aria-hidden="true">
                    +{more}장
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ImageLightbox
        items={listing.photos}
        index={viewing}
        onIndexChange={setViewing}
        title="매물 사진"
        subject={name}
        altNoun="사진"
      />
    </Panel>
  );
}

/** 매물 검수 상세 (`/listings/[id]`): facts, co-brokers, verifications, reports, history + actions. */
export function ListingDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ListingModerationAction | null>(null);

  const {
    data: listing,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: modKeys.listing(id),
    queryFn: ({ signal }) => fetchListing(id, signal),
  });

  const moderate = useMutation({
    mutationFn: (v: { action: ListingModerationAction; reason: string }) =>
      moderateListing(id, v.action, v.reason || undefined),
    onSuccess: (next, v) => {
      queryClient.setQueryData(modKeys.listing(id), next);
      void queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      toast(ACTION_COPY[v.action].done);
      setAction(null);
    },
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !listing)
    return (
      <DetailError
        error={error}
        onRetry={() => void refetch()}
        backHref={ADMIN_ROUTES.listings}
        backLabel="매물 목록으로"
        subject="매물"
      />
    );

  const status = LISTING_STATUS_META[listing.status];
  const name = listingName(listing);
  const price = listingPrice(listing);
  const live = listing.status === ListingStatus.ACTIVE || listing.status === ListingStatus.RESERVED;
  const openReports = listing.reports.filter(
    (r) => r.status === 'RECEIVED' || r.status === 'IN_REVIEW',
  );
  const copy = action ? ACTION_COPY[action] : null;
  const address = [listing.roadAddress, listing.dong].filter(Boolean).join(' ');

  return (
    <div className={s.detail}>
      <AdminPageHeader
        title="매물 검수"
        crumb={['매물 · 회원', { label: '매물 관리', href: ADMIN_ROUTES.listings }]}
      />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.listings}>
        매물 목록
      </BackLink>

      <DetailHero
        eyebrow={
          <>
            매물 <span className={s.num}>{shortId(listing.id)}</span> ·{' '}
            {ASSET_TYPE_LABEL[listing.assetType]}
            {listing.title && listing.title !== name ? ` · ${listing.title}` : ''}
          </>
        }
        title={name}
        badges={
          <>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {listing.reviewFlags.map((flag) => (
              <Badge key={flag} tone={flag === 'REPORTED' ? 'danger' : 'warn'}>
                {REVIEW_FLAG_LABEL[flag]}
              </Badge>
            ))}
          </>
        }
        meta={
          <>
            <span className={l.priceRow}>
              <DealBadge deal={dealKindOf(listing.dealType)} />
              <strong className={l.heroPrice}>{price}</strong>
              {listing.premium != null && <PremiumBadge amount={listing.premium} />}
            </span>
            <span>
              <Icon name="map-pin" size={14} />
              {listing.emdName}
            </span>
            <span>
              <Icon name="users" size={14} />
              중개사 {listing.agencyCount}곳
            </span>
            {listing.publishedAt && (
              <span>
                <Icon name="calendar" size={14} />
                {formatDate(listing.publishedAt)} 광고 시작
              </span>
            )}
          </>
        }
        aside={
          live ? (
            <Button
              size="sm"
              variant="secondary"
              href={`${env.siteUrl}/listing/${listing.id}`}
              target="_blank"
              rel="noopener"
              iconRight={<Icon name="external-link" size={16} />}
            >
              사이트에서 보기
            </Button>
          ) : undefined
        }
      />

      <AuditNotice subject="비공개 호수와 담당 중개사 연락처" />
      {listing.status === ListingStatus.HIDDEN && (
        <Callout size="sm" tone="danger">
          <strong>숨김 처리된 매물이에요.</strong> 사이트에 노출되지 않아요.
          {listing.hiddenReason && <> 사유: {listing.hiddenReason}</>}
        </Callout>
      )}
      {openReports.length > 0 && (
        <Callout size="sm" tone="warn" icon="siren">
          <strong>처리 대기 중인 신고가 {openReports.length}건 있어요.</strong> 신고 내용을 확인한
          뒤 숨김 여부를 결정해 주세요.{' '}
          <Link href={`${ADMIN_ROUTES.reports}/${openReports[0]?.id}`} className="link">
            신고 보기
          </Link>
        </Callout>
      )}

      <DetailGrid
        main={
          <>
            <PhotosPanel listing={listing} />

            <Panel title="매물 정보" description="표시·광고 명시사항 기준">
              <InfoList
                items={[
                  {
                    label: '거래 · 가격',
                    value: (
                      <span className={l.priceRow}>
                        <DealBadge deal={dealKindOf(listing.dealType)} />
                        <span className={l.price}>{price}</span>
                      </span>
                    ),
                  },
                  {
                    label: '관리비',
                    value:
                      listing.maintenanceFeeWon != null
                        ? `월 ${formatMaintenanceFee(listing.maintenanceFeeWon)}`
                        : null,
                  },
                  {
                    label: '공급면적',
                    value: listing.supplyArea ? formatAreaBoth(listing.supplyArea) : null,
                  },
                  {
                    label: '전용면적',
                    value: listing.exclusiveArea ? formatAreaBoth(listing.exclusiveArea) : null,
                  },
                  {
                    label: '층',
                    value:
                      listing.floor != null
                        ? `${formatFloor({ floor: listing.floor, totalFloors: listing.totalFloors })}${
                            listing.floorClass
                              ? ` (사이트 표시 ${formatFloor({ floorClass: listing.floorClass, totalFloors: listing.totalFloors })})`
                              : ''
                          }`
                        : null,
                  },
                  {
                    label: '방 · 욕실',
                    value:
                      listing.rooms != null || listing.baths != null
                        ? `방 ${listing.rooms ?? '–'} · 욕실 ${listing.baths ?? '–'}`
                        : null,
                  },
                  {
                    label: '방향',
                    value: listing.direction ? DIRECTION_LABEL[listing.direction] : null,
                  },
                  {
                    label: '사용승인일',
                    value: listing.approvalDate ? formatDate(listing.approvalDate) : null,
                  },
                  {
                    label: '입주 가능',
                    value: listing.moveInType
                      ? listing.moveInType === 'DATE' && listing.moveInDate
                        ? `${formatDate(listing.moveInDate)} 이후`
                        : MOVE_IN_TYPE_LABEL[listing.moveInType]
                      : null,
                  },
                  {
                    label: '주차',
                    value: listing.parkingSpaces != null ? `${listing.parkingSpaces}대` : null,
                  },
                  {
                    label: '소재지',
                    wide: true,
                    value: (
                      <>
                        {address || listing.emdName}
                        {listing.ho && (
                          <>
                            {' '}
                            {listing.ho}
                            <span className={l.private}>
                              <Icon name="lock" size={12} />
                              호수 비공개
                            </span>
                          </>
                        )}
                      </>
                    ),
                  },
                  {
                    label: '옵션',
                    wide: true,
                    value:
                      listing.options.length > 0 ? (
                        <span className={s.tagRow}>
                          {listing.options.map((o) => (
                            <Tag key={o}>{LISTING_OPTION_LABEL[o]}</Tag>
                          ))}
                        </span>
                      ) : null,
                  },
                  {
                    label: '상세 설명',
                    wide: true,
                    value: listing.description ? (
                      <span className={s.prose}>{listing.description}</span>
                    ) : null,
                  },
                ]}
              />
            </Panel>

            <Panel title="광고 중개사무소" count={listing.agencies.length} flush>
              <ul className={s.rows}>
                {listing.agencies.map((ag) => (
                  <li key={ag.agencyId} className={s.row}>
                    <span className={s.rowMain}>
                      <Link href={`${ADMIN_ROUTES.agencies}/${ag.agencyId}`} className={s.rowTitle}>
                        {ag.name}
                      </Link>
                      <span className={s.rowSub}>
                        {[
                          ag.contactName ? `담당 ${ag.contactName}` : null,
                          ag.phone ? formatPhone(ag.phone) : null,
                          ag.joinedAt ? `${formatDate(ag.joinedAt)} 참여` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className={s.rowSide}>
                      {ag.isPrimary && <Badge tone="ink">대표 중개</Badge>}
                      {ag.status === 'WITHDRAWN' && <Badge>철회</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="실매물 확인 기록" count={listing.verifications.length} flush>
              {listing.verifications.length === 0 ? (
                <p className={s.actionHint} style={{ padding: 20 }}>
                  아직 실매물 확인 기록이 없어요.
                </p>
              ) : (
                <ul className={s.rows}>
                  {listing.verifications.map((v) => (
                    <li key={v.id} className={s.row}>
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{VERIFICATION_METHOD_LABEL[v.method]}</span>
                        <span className={s.rowSub}>
                          {[v.byName, v.note].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={`${s.rowSide} ${s.num}`}>{formatDate(v.verifiedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {listing.reports.length > 0 && (
              <Panel title="신고 내역" count={listing.reports.length} flush>
                <ul className={s.rows}>
                  {listing.reports.map((r) => (
                    <li key={r.id} className={s.row}>
                      <span className={s.rowMain}>
                        <Link href={`${ADMIN_ROUTES.reports}/${r.id}`} className={s.rowTitle}>
                          {REPORT_REASON_LABEL[r.reason]}
                        </Link>
                        <span className={s.rowSub}>{formatRelativeTime(r.createdAt)} 접수</span>
                      </span>
                      <span className={s.rowSide}>
                        <StatusPill tone={REPORT_STATUS_META[r.status].tone}>
                          {REPORT_STATUS_META[r.status].label}
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
            <Panel title="검수">
              <div className={s.sideStatus}>
                <span>현재 상태</span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
              <div className={s.actions}>
                {live && (
                  <Button variant="danger" block onClick={() => setAction('hide')}>
                    숨김 처리
                  </Button>
                )}
                {listing.status === ListingStatus.HIDDEN && (
                  <Button block onClick={() => setAction('unhide')}>
                    숨김 해제
                  </Button>
                )}
                {(live || listing.status === ListingStatus.HIDDEN) && (
                  <Button variant="secondary" block onClick={() => setAction('close')}>
                    광고 강제 종료
                  </Button>
                )}
                <p className={s.actionHint}>
                  {listing.status === ListingStatus.CLOSED
                    ? `${listing.closedAt ? `${formatDate(listing.closedAt)}에 ` : ''}종료된 매물이에요. 종료된 매물은 다시 광고할 수 없어요.`
                    : listing.status === ListingStatus.DRAFT
                      ? '작성 중인 매물은 검수 대상이 아니에요.'
                      : '숨김은 되돌릴 수 있고, 강제 종료는 되돌릴 수 없어요. 모든 처리는 작업 기록에 남아요.'}
                </p>
              </div>
            </Panel>

            <Panel title="지표">
              <MiniStats
                items={[
                  { label: '조회', value: formatCount(listing.viewCount) },
                  { label: '관심', value: formatCount(listing.favoriteCount) },
                  { label: '대기 신고', value: listing.openReportCount, unit: '건' },
                ]}
              />
              <p className={s.actionHint} style={{ marginTop: 12 }}>
                실매물 확인{' '}
                {listing.verifiedAt ? (
                  formatDate(listing.verifiedAt)
                ) : (
                  <span className={s.warnText}>미확인</span>
                )}
                {listing.expiresAt && <> · 광고 만료 {formatDate(listing.expiresAt)}</>}
              </p>
            </Panel>

            <Panel title="변경 이력" count={listing.history.length}>
              <Timeline
                label="매물 변경 이력"
                items={listing.history.map((h) => ({
                  id: h.id,
                  tone: isModerationAction(h.action)
                    ? 'danger'
                    : h.action === 'LISTING_VERIFIED' || h.action === 'LISTING_UNHIDDEN'
                      ? 'success'
                      : h.action === 'LISTING_PUBLISHED'
                        ? 'brand'
                        : 'default',
                  title: historyLabel(h.action),
                  meta: [
                    h.actorType === 'ADMIN'
                      ? `관리자 ${h.actorName ?? ''}`.trim()
                      : h.actorType === 'SYSTEM'
                        ? '시스템'
                        : h.actorName,
                    formatDateTime(h.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  note: h.note ?? undefined,
                }))}
              />
            </Panel>
          </>
        }
      />

      {copy && action && (
        <ReasonDialog
          open
          onClose={() => {
            setAction(null);
            moderate.reset();
          }}
          title={copy.title}
          description={copy.description}
          target={{
            title: `${name} · ${price}`,
            sub: `${listing.primaryAgency.name}${listing.agencyCount > 1 ? ` 외 ${listing.agencyCount - 1}곳` : ''}`,
          }}
          reasonLabel={copy.label}
          presets={copy.presets}
          required={copy.required}
          confirmLabel={copy.confirm}
          danger={copy.danger}
          loading={moderate.isPending}
          error={moderate.isError ? errorMessage(moderate.error) : null}
          onConfirm={(reason) => moderate.mutate({ action, reason })}
        />
      )}
    </div>
  );
}
