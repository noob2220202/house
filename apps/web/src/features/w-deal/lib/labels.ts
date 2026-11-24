import {
  AssetType,
  DealRequestStatus,
  type DealRequestType,
  DealType,
  ProposalStatus,
  type DealRequestVisibility,
} from '@house/shared';
import type { CategoryIconName, IconName } from '@house/ui';

/** Asset-type tiles of the forms (design order), with the site's category icons. */
export const ASSET_TILES: readonly {
  value: AssetType;
  label: string;
  icon: CategoryIconName | { icon: IconName };
}[] = [
  { value: AssetType.APT, label: '아파트·분양권', icon: 'apt' },
  { value: AssetType.OFFICETEL, label: '오피스텔', icon: { icon: 'building' } },
  { value: AssetType.ONEROOM, label: '원룸·투룸', icon: 'room' },
  { value: AssetType.HOUSE, label: '주택', icon: 'house' },
  { value: AssetType.COMMERCIAL, label: '상업·업무', icon: 'biz' },
  { value: AssetType.LAND, label: '토지', icon: 'land' },
];

/** Deal types an asset type can be traded with (분양권 only for 아파트·오피스텔, no 전세 for 토지). */
export function dealTypesFor(assetType: AssetType | ''): DealType[] {
  switch (assetType) {
    case AssetType.APT:
    case AssetType.OFFICETEL:
      return [DealType.SALE, DealType.JEONSE, DealType.MONTHLY, DealType.PRESALE];
    case AssetType.LAND:
      return [DealType.SALE, DealType.MONTHLY];
    default:
      return [DealType.SALE, DealType.JEONSE, DealType.MONTHLY];
  }
}

export const REQUEST_STATUS_LABEL: Record<DealRequestStatus, string> = {
  OPEN: '제안 받는 중',
  MATCHED: '중개사 선택 완료',
  CLOSED: '종료',
  CANCELLED: '취소',
  EXPIRED: '기간 만료',
};

/** StatusPill tone per request status. */
export const REQUEST_STATUS_TONE: Record<
  DealRequestStatus,
  'live' | 'scheduled' | 'review' | 'ended' | 'rejected'
> = {
  OPEN: 'live',
  MATCHED: 'scheduled',
  CLOSED: 'ended',
  CANCELLED: 'ended',
  EXPIRED: 'ended',
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  SENT: '새 제안',
  VIEWED: '검토 중',
  ACCEPTED: '수락함',
  DECLINED: '거절함',
  WITHDRAWN: '중개사 철회',
};

export const VISIBILITY_LABEL: Record<DealRequestVisibility, string> = {
  ALL_AGENCIES_IN_REGION: '전체 중개사',
  SELECTED_AGENCIES: '선택한 중개사',
};

export const REQUEST_TYPE_TITLE: Record<DealRequestType, string> = {
  SELL_OR_LEASE: '내 집 내놓기',
  WANTED: '원하는 집 구하기',
};

export function isRequestActive(status: DealRequestStatus): boolean {
  return status === DealRequestStatus.OPEN || status === DealRequestStatus.MATCHED;
}

export function isProposalPending(status: ProposalStatus): boolean {
  return status === ProposalStatus.SENT || status === ProposalStatus.VIEWED;
}

/** Max agencies for SELECTED_AGENCIES (design: 최대 5곳; the API allows 20). */
export const MAX_TARGET_AGENCIES = 5;
/** Photo limits shown in the uploader (design: 장당 10MB, 최대 20장). */
export const MAX_REQUEST_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
