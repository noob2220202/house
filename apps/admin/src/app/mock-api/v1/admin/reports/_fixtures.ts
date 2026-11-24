import {
  REPORT_REASON_LABEL,
  type ReportAction,
  type ReportReason,
  type ReportStatus,
  type ReportTargetType,
} from '@house/shared';
import type { AdminReportDetail, AdminReportListItem } from '@/features/m-moderation/api/schemas';
import { ago, mid, mockTable } from '@/features/m-moderation/mock/handler';
import { AGENCY_ID, agenciesDb } from '../agencies/_fixtures';
import { LISTING_ID, listingsDb } from '../listings/_fixtures';
import { memberId, usersDb } from '../users/_fixtures';

/** Stored report row (the detail payload is assembled with live listing / agency data). */
export interface MockReport {
  id: string;
  targetType: ReportTargetType;
  listingId: string | null;
  agencyId: string | null;
  reason: ReportReason;
  status: ReportStatus;
  action: ReportAction | null;
  detail: string | null;
  createdAt: string;
  handledAt: string | null;
  reporterUserId: string;
  reporterPhone: string | null;
  /** Outcome text forwarded to the reporter / office (set by 조치 · 기각). */
  resolutionNote: string | null;
  /** Moderators' internal memo — never leaves the back office. */
  internalNote: string | null;
  handledByName: string | null;
  attachments: { id: string; fileName: string; lines: string[] }[];
  timeline: AdminReportDetail['timeline'];
}

function seed(): MockReport[] {
  const row = (
    n: number,
    r: Omit<
      MockReport,
      | 'id'
      | 'timeline'
      | 'attachments'
      | 'reporterPhone'
      | 'targetType'
      | 'listingId'
      | 'agencyId'
      | 'internalNote'
    > &
      Partial<
        Pick<
          MockReport,
          'attachments' | 'reporterPhone' | 'listingId' | 'agencyId' | 'internalNote'
        >
      >,
  ): MockReport => {
    const id = mid('e5', n);
    const timeline: MockReport['timeline'] = [];
    if (r.handledAt)
      timeline.push({
        id: mid('e4', n * 10 + 2),
        status: r.status,
        note: r.resolutionNote,
        adminName: r.handledByName,
        createdAt: r.handledAt,
      });
    if (r.status !== 'RECEIVED')
      timeline.push({
        id: mid('e4', n * 10 + 1),
        status: 'IN_REVIEW',
        note: null,
        adminName: r.handledByName ?? '운영자',
        createdAt: r.handledAt
          ? ago({
              d: Math.round((Date.now() - new Date(r.handledAt).getTime()) / 86_400_000),
              h: 5,
            })
          : ago({ h: 20 }),
      });
    timeline.push({
      id: mid('e4', n * 10),
      status: 'RECEIVED',
      note: null,
      adminName: null,
      createdAt: r.createdAt,
    });
    return {
      id,
      targetType: r.listingId ? 'LISTING' : 'AGENCY',
      listingId: r.listingId ?? null,
      agencyId: r.agencyId ?? null,
      reporterPhone: r.reporterPhone ?? null,
      internalNote: r.internalNote ?? null,
      attachments: r.attachments ?? [],
      ...r,
      timeline,
    };
  };
  return [
    row(1, {
      listingId: LISTING_ID.L09,
      reason: 'WRONG_PRICE',
      status: 'RECEIVED',
      action: null,
      detail:
        '전화해 보니 3억 1,000이 아니라 3억 6,000이라고 합니다. 광고 가격은 손님을 끌려는 미끼 같아요. 통화 직후 받은 문자를 첨부합니다.',
      createdAt: ago({ m: 40 }),
      handledAt: null,
      reporterUserId: memberId(3),
      reporterPhone: '01000001103',
      resolutionNote: null,
      handledByName: null,
      attachments: [
        {
          id: mid('e3', 11),
          fileName: '문자_캡처.png',
          lines: [
            '3억 1천 매물 아직 있나요?',
            '그건 나갔고 3억 6천 있어요',
            '광고엔 3억 1천인데요?',
            '일단 방문해 보세요',
          ],
        },
      ],
    }),
    row(2, {
      listingId: LISTING_ID.L04,
      reason: 'ALREADY_DEALT',
      status: 'RECEIVED',
      action: null,
      detail: '지난주에 이미 계약됐다고 이웃에게 들었는데 아직 광고 중입니다.',
      createdAt: ago({ h: 2, m: 10 }),
      handledAt: null,
      reporterUserId: memberId(5),
      resolutionNote: null,
      handledByName: null,
    }),
    row(3, {
      listingId: LISTING_ID.L09,
      reason: 'WRONG_PRICE',
      status: 'RECEIVED',
      action: null,
      detail: '방문했더니 그 가격 매물은 없다면서 다른 매물을 권유했습니다.',
      createdAt: ago({ h: 3, m: 25 }),
      handledAt: null,
      reporterUserId: memberId(9),
      resolutionNote: null,
      handledByName: null,
    }),
    row(4, {
      agencyId: AGENCY_ID.B07,
      reason: 'UNREACHABLE',
      status: 'RECEIVED',
      action: null,
      detail:
        '세 번 전화했는데 받지 않고 문자에도 답이 없어요. 광고 매물이 실제로 있는지 모르겠습니다.',
      createdAt: ago({ h: 5, m: 5 }),
      handledAt: null,
      reporterUserId: memberId(14),
      resolutionNote: null,
      handledByName: null,
    }),
    row(5, {
      listingId: LISTING_ID.R01,
      reason: 'WRONG_PHOTO',
      status: 'IN_REVIEW',
      action: null,
      detail:
        '사진은 신축 같은데 실제로 본 방은 다른 건물이었습니다. 사진 속 창문 구조가 실제와 달라요.',
      createdAt: ago({ d: 1, h: 3 }),
      handledAt: null,
      reporterUserId: memberId(1),
      reporterPhone: '01000001101',
      resolutionNote: null,
      internalNote:
        '대표 중개사(순천대정문)에 사진 원본과 촬영일 확인 요청함. 11.25까지 회신 예정.',
      handledByName: '운영자',
      attachments: [
        {
          id: mid('e3', 51),
          fileName: '현장_사진_비교.png',
          lines: ['사진이랑 방이 다른데요', '같은 건물 다른 호실이에요', '광고 호실을 보여 주세요'],
        },
        {
          id: mid('e3', 52),
          fileName: '광고_화면.png',
          lines: ['광고 사진의 창문은 2개', '실제 방은 창문 1개'],
        },
      ],
    }),
    row(6, {
      listingId: LISTING_ID.X01,
      reason: 'NOT_EXIST',
      status: 'RESOLVED',
      action: 'LISTING_HIDDEN_AGENCY_WARNED',
      detail: '해당 건물에 402호가 없습니다. 4층은 주인 세대예요.',
      createdAt: ago({ d: 6, h: 7 }),
      handledAt: ago({ d: 5, h: 2 }),
      reporterUserId: memberId(2),
      resolutionNote:
        '건축물대장 확인 결과 402호 없음. 매물 숨김 및 중개사무소 경고(3회 누적 → 이용 정지).',
      handledByName: '한지우',
    }),
    row(7, {
      listingId: LISTING_ID.X02,
      reason: 'ALREADY_DEALT',
      status: 'RESOLVED',
      action: 'LISTING_HIDDEN',
      detail: '10월에 거래된 집입니다. 실거래가 공개 내역에도 나와요.',
      createdAt: ago({ d: 6, h: 1 }),
      handledAt: ago({ d: 5, h: 2 }),
      reporterUserId: memberId(6),
      resolutionNote: '실거래 신고 내역(10.28)과 일치. 매물 숨김 처리.',
      handledByName: '한지우',
    }),
    row(8, {
      listingId: LISTING_ID.L01,
      reason: 'WRONG_INFO',
      status: 'REJECTED',
      action: 'NONE',
      detail: '남향이라고 되어 있는데 남동향 같습니다.',
      createdAt: ago({ d: 8, h: 4 }),
      handledAt: ago({ d: 7, h: 6 }),
      reporterUserId: memberId(18),
      resolutionNote: '단지 배치도와 현장 사진으로 거실 기준 남향 확인. 신고 내용이 사실과 다름.',
      handledByName: '운영자',
    }),
    row(9, {
      agencyId: AGENCY_ID.B02,
      reason: 'UNREACHABLE',
      status: 'RESOLVED',
      action: 'AGENCY_WARNED',
      detail: '일주일째 연락이 닿지 않습니다.',
      createdAt: ago({ d: 11, h: 2 }),
      handledAt: ago({ d: 9, h: 3 }),
      reporterUserId: memberId(10),
      resolutionNote: '대표번호 변경 후 프로필 미수정 확인. 경고 및 정보 수정 요청.',
      handledByName: '한지우',
    }),
    row(10, {
      listingId: LISTING_ID.L03,
      reason: 'DUPLICATE',
      status: 'REJECTED',
      action: 'NONE',
      detail: '같은 집이 여러 부동산 이름으로 올라와 있어요.',
      createdAt: ago({ d: 13, h: 6 }),
      handledAt: ago({ d: 12, h: 1 }),
      reporterUserId: memberId(18),
      resolutionNote: '공동중개 매물(중개사 4곳)로 1건으로 노출 중. 중복 아님.',
      handledByName: '운영자',
    }),
    row(11, {
      listingId: LISTING_ID.L09,
      reason: 'WRONG_PRICE',
      status: 'REJECTED',
      action: 'NONE',
      detail: '너무 싸서 이상합니다.',
      createdAt: ago({ d: 15, h: 3 }),
      handledAt: ago({ d: 14, h: 5 }),
      reporterUserId: memberId(18),
      resolutionNote: '당시 소유자 확인서로 급매 가격 확인됨.',
      handledByName: '운영자',
    }),
  ];
}

export function reportsDb(): MockReport[] {
  return mockTable('reports', seed);
}

const isOpen = (s: ReportStatus) => s === 'RECEIVED' || s === 'IN_REVIEW';

/** Recomputes a listing's open-report counter + REPORTED flag from the reports table. */
export function syncListingReports(listingId: string): void {
  const listing = listingsDb().find((l) => l.id === listingId);
  if (!listing) return;
  listing.openReportCount = reportsDb().filter(
    (r) => r.listingId === listingId && isOpen(r.status),
  ).length;
  const flags = listing.reviewFlags.filter((f) => f !== 'REPORTED');
  listing.reviewFlags = listing.openReportCount > 0 ? ['REPORTED', ...flags] : flags;
}

function listingRef(id: string | null): AdminReportListItem['listing'] {
  const l = id ? listingsDb().find((x) => x.id === id) : undefined;
  if (!l) return null;
  return {
    id: l.id,
    title: l.title,
    assetType: l.assetType,
    status: l.status,
    dealType: l.dealType,
    salePrice: l.salePrice,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    presalePrice: l.presalePrice,
    premium: l.premium,
    complexName: l.complexName,
    buildingName: l.buildingName,
    dong: l.dong,
    emdName: l.emdName,
    supplyArea: l.supplyArea,
    exclusiveArea: l.exclusiveArea,
    floorClass: l.floorClass,
    floor: l.floor,
    totalFloors: l.totalFloors,
    verifiedAt: l.verifiedAt,
    publishedAt: l.publishedAt,
    photoCount: l.photoCount,
    coverUrl: l.coverUrl,
  };
}

function agencyRef(r: MockReport): AdminReportListItem['agency'] {
  const listing = r.listingId ? listingsDb().find((x) => x.id === r.listingId) : undefined;
  const agencyId = r.agencyId ?? listing?.primaryAgency.id;
  const a = agenciesDb().find((x) => x.id === agencyId);
  if (!a) return null;
  return {
    id: a.id,
    name: a.name,
    representativeName: a.representativeName,
    phone: a.phone,
    status: a.status,
    warningCount: a.warningCount,
  };
}

const sameTarget = (a: MockReport, b: MockReport) =>
  a.targetType === b.targetType && a.listingId === b.listingId && a.agencyId === b.agencyId;

export function toReportListItem(r: MockReport): AdminReportListItem {
  return {
    id: r.id,
    targetType: r.targetType,
    reason: r.reason,
    status: r.status,
    action: r.action,
    detail: r.detail,
    createdAt: r.createdAt,
    handledAt: r.handledAt,
    listing: listingRef(r.listingId),
    agency: agencyRef(r),
    sameTargetCount: reportsDb().filter((x) => sameTarget(x, r)).length,
  };
}

export function toReportDetail(r: MockReport): AdminReportDetail {
  const all = reportsDb();
  const reporter = usersDb().find((u) => u.id === r.reporterUserId);
  const mine = all.filter((x) => x.reporterUserId === r.reporterUserId);
  return {
    ...toReportListItem(r),
    reporter: {
      id: r.reporterUserId,
      nickname: reporter?.nickname ?? null,
      reportCount: mine.length,
      upheldCount: mine.filter((x) => x.status === 'RESOLVED').length,
    },
    reporterPhone: r.reporterPhone,
    resolutionNote: r.resolutionNote,
    internalNote: r.internalNote,
    handledByName: r.handledByName,
    attachments: r.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      url: `/mock-api/v1/admin/reports/${r.id}/attachments/${a.id}`,
    })),
    relatedReports: all
      .filter((x) => x.id !== r.id && sameTarget(x, r))
      .map((x) => ({
        id: x.id,
        reason: x.reason,
        status: x.status,
        action: x.action,
        createdAt: x.createdAt,
      })),
    timeline: r.timeline,
  };
}

export const reportReasonLabel = (reason: ReportReason) => REPORT_REASON_LABEL[reason];
