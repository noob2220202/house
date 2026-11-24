import {
  AssetType,
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  ROOM_TYPE_LABEL,
  effectiveRoomType,
  landCategoryOf,
  landZoneOf,
} from '@house/shared';
import { FIELD_STEP, hasRoomType, isLand, type DraftPayload, type FormField } from './form';

/**
 * 검색 정보 — not 표시·광고 명시사항 (publishing never waits for them), but the map filters find a
 * listing only by them: 방 구성 for 원룸·투룸 (방 종류 filter), 지목 / 용도지역 for 토지. The API
 * derives the same search groups (shared `effectiveRoomType` / `landCategoryOf` / `landZoneOf`).
 */
export interface SearchInfoItem {
  field: 'roomType' | 'landCategory' | 'zoning';
  formField: FormField;
  label: string;
  step: number;
  /** The listing falls into a search group. */
  done: boolean;
  /** Search group label ("1.5룸", "주거지역"), null while unknown. */
  group: string | null;
}

const item = (
  field: SearchInfoItem['field'],
  label: string,
  group: string | null,
): SearchInfoItem => ({
  field,
  formField: field,
  label,
  step: FIELD_STEP[field],
  done: group !== null,
  group,
});

export function searchInfoItems(d: DraftPayload): SearchInfoItem[] {
  const p = d.property;
  if (hasRoomType(p.assetType)) {
    const type = effectiveRoomType(AssetType.ONEROOM, p.roomType, p.rooms);
    return [item('roomType', '방 구성', type ? ROOM_TYPE_LABEL[type] : null)];
  }
  if (isLand(p.assetType)) {
    const category = landCategoryOf(p.landCategory);
    const zone = landZoneOf(p.zoning);
    return [
      item('landCategory', '지목', category ? LAND_CATEGORY_LABEL[category] : null),
      item('zoning', '용도지역', zone ? LAND_ZONE_LABEL[zone] : null),
    ];
  }
  return [];
}
