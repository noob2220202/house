import {
  ASSET_TYPE_LABEL,
  AssetType,
  DEAL_TYPE_LABEL,
  DIRECTION_BASIS_LABEL,
  DIRECTION_LABEL,
  DealType,
  FloorDisplay,
  LISTING_STATUS_LABEL,
  MOVE_IN_TYPE_LABEL,
  MoveInType,
  ROOM_TYPE_LABEL,
  VERIFICATION_METHOD_LABEL,
  effectiveRoomType,
  type VerificationMethod,
} from '@house/shared';
import type { DealKind, IconName } from '@house/ui';
import { ROUTES, type MapAssetSlug } from '@/config/nav';
import {
  formatCount,
  formatDate,
  formatDateShort,
  formatDealPrice,
  formatFloor,
  formatMaintenanceFee,
  formatManwon,
  formatAreaBoth,
  formatAreaPair,
  formatPhone,
  formatSqm,
  formatYearMonth,
  kstParts,
  sqmToPyeong,
  type AreaUnit,
} from '@/lib/format';
import type { ListingDetail, ListingSummary } from '../api/schemas';

/** Display helpers that turn the API payload into the strings the page shows (unit tested). */

export const DEAL_KIND: Record<DealType, DealKind> = {
  SALE: 'sale',
  JEONSE: 'jeonse',
  MONTHLY: 'monthly',
  PRESALE: 'presale',
};

const PRICE_LABEL: Record<DealType, string> = {
  SALE: '매매가',
  JEONSE: '전세가',
  MONTHLY: '보증금 / 월세',
  PRESALE: '분양권 매매가',
};

export const ASSET_SLUG: Record<AssetType, MapAssetSlug> = {
  APT: 'apt',
  OFFICETEL: 'apt',
  ONEROOM: 'oneroom',
  HOUSE: 'house',
  COMMERCIAL: 'commercial',
  LAND: 'land',
};
const ASSET_NAV_LABEL: Record<MapAssetSlug, string> = {
  apt: '아파트·분양권',
  oneroom: '원룸·투룸',
  house: '주택',
  commercial: '상업·업무',
  land: '토지',
};

type PriceFields = Pick<
  ListingDetail,
  'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice' | 'premium'
>;

/** Total price in 만원 the buyer / tenant pays up front (월세: 보증금). Null when undisclosed. */
export function headlineAmount(l: PriceFields): number | null {
  switch (l.dealType) {
    case DealType.SALE:
      return l.salePrice ?? null;
    case DealType.PRESALE:
      return l.presalePrice !== null && l.presalePrice !== undefined
        ? l.presalePrice + (l.premium ?? 0)
        : (l.salePrice ?? null);
    default:
      return l.deposit ?? null;
  }
}

export interface HeadlinePrice {
  kind: DealKind;
  /** "매매가" */
  label: string;
  /** "4억 4,500" · "2,000/65" · "가격 협의" */
  text: string;
  /** "만원" — empty when the price is undisclosed. */
  unit: string;
  /** Extra line: "분양가 3억 9,200 + 프리미엄 2,700". */
  note: string | null;
  amount: number | null;
}

export function headlinePrice(l: PriceFields): HeadlinePrice {
  const amount = headlineAmount(l);
  const text = formatDealPrice({
    dealType: l.dealType,
    price: l.dealType === DealType.MONTHLY ? null : amount,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
  const undisclosed = text === '가격 협의';
  let note: string | null = null;
  if (
    l.dealType === DealType.PRESALE &&
    l.presalePrice !== null &&
    l.presalePrice !== undefined &&
    l.premium !== null &&
    l.premium !== undefined
  ) {
    note = `분양가 ${formatManwon(l.presalePrice)} ${l.premium >= 0 ? '+' : '−'} 프리미엄 ${formatManwon(Math.abs(l.premium))}`;
  }
  return {
    kind: DEAL_KIND[l.dealType],
    label: PRICE_LABEL[l.dealType],
    text,
    // "4억" already ends with a unit word; "4억 4,500" and "500/45" need 만원.
    unit: undisclosed || text.endsWith('억') ? (undisclosed ? '' : '원') : '만원',
    note,
    amount,
  };
}

/** "매매 4억 4,500" / "월세 2,000/65" — for titles, share text, recent views. */
export function priceLabel(l: PriceFields): string {
  return `${DEAL_TYPE_LABEL[l.dealType]} ${headlinePrice(l).text}`;
}

/** 공급면적 기준 평당가 (만원/평), 매매·분양권 only. */
export function pricePerPyeong(l: ListingDetail): number | null {
  if (l.dealType !== DealType.SALE && l.dealType !== DealType.PRESALE) return null;
  const amount = headlineAmount(l);
  const area = l.property.supplyArea ?? l.property.exclusiveArea ?? l.property.landArea;
  if (!amount || !area) return null;
  return Math.round(amount / sqmToPyeong(area, 4));
}

/**
 * "전용 84.98㎡ (25.7평)": the 전용면적 the 명시사항 state, in the legal unit (계량법: ㎡) with 평
 * alongside; the 공급면적 only when no 전용 is known (then labelled so).
 */
export function areaLabel(l: ListingDetail): string | null {
  const type = l.complex?.areaTypes.find((t) => t.id === l.property.areaTypeId);
  const exclusive = l.property.exclusiveArea ?? type?.exclusiveArea;
  if (exclusive) return `전용 ${formatAreaBoth(exclusive)}`;
  const supply = l.property.supplyArea ?? type?.supplyArea;
  return supply ? `공급 ${formatAreaBoth(supply)}` : null;
}

export function floorText(
  l: Pick<ListingDetail, 'floorDisplay' | 'floorClass' | 'property'>,
): string {
  const exact =
    l.floorDisplay === FloorDisplay.EXACT &&
    l.property.floor !== null &&
    l.property.floor !== undefined;
  return formatFloor(
    exact
      ? { floor: l.property.floor, totalFloors: l.property.totalFloors }
      : { floorClass: l.floorClass ?? null, totalFloors: l.property.totalFloors, showExact: false },
  );
}

/** Complex / building name (the h1 main part). */
export function listingName(l: ListingDetail): string {
  return (
    l.complex?.name ?? l.property.buildingName ?? l.title ?? `${ASSET_TYPE_LABEL[l.assetType]} 매물`
  );
}

/** "103동 · 고/25층" — lighter text after the name. */
export function listingSubtitle(l: ListingDetail): string {
  return [l.property.dong, floorText(l)].filter(Boolean).join(' · ');
}

/** Full one-line title for <title>, share and JSON-LD: "신대 레이크파크 1단지 103동 매매 4억 4,500". */
export function listingFullTitle(l: ListingDetail): string {
  return [listingName(l), l.property.dong, priceLabel(l)].filter(Boolean).join(' ');
}

/** Region line without 호수: "순천시 해룡면 신대리". */
export function regionLine(l: ListingDetail): string {
  const emd = l.property.emdName ?? l.complex?.emdName;
  if (emd) return `순천시 ${emd}`;
  // 시도 prefix: 전남광주통합특별시 since 2026-07-01 (D1); older addresses may still say 전라남도.
  return l.property.roadAddress
    .replace(/^(전남광주통합특별시|전라남도)\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
}

/** "순천시 해룡면 신대리 · 1,412세대 · 2019년 6월 준공" */
export function addressLine(l: ListingDetail, short = false): string {
  const parts = [short ? regionLine(l).replace(/^순천시\s*/, '') : regionLine(l)];
  if (l.complex?.households) parts.push(`${formatCount(l.complex.households)}세대`);
  const approval = l.complex?.approvalDate ?? l.property.approvalDate;
  const p = approval ? kstParts(approval) : null;
  if (p) {
    const future = Date.parse(approval ?? '') > Date.now();
    parts.push(
      short
        ? `${p.year}년 ${future ? '입주' : '준공'}`
        : `${p.year}년 ${Number(p.month)}월 ${future ? '입주 예정' : '준공'}`,
    );
  } else if (l.complex?.builtYear) parts.push(`${l.complex.builtYear}년 준공`);
  return parts.join(' · ');
}

export function listingNo(l: Pick<ListingDetail, 'id' | 'listingNo'>): string {
  return l.listingNo ?? l.id.slice(0, 8).toUpperCase();
}

export function moveInText(l: Pick<ListingDetail, 'moveInType' | 'moveInDate'>): {
  value: string;
  sub: string | null;
} {
  if (l.moveInType === MoveInType.DATE && l.moveInDate) {
    return {
      value: formatYearMonth(l.moveInDate),
      sub: `${formatDate(l.moveInDate)} 이후 · 협의 가능`,
    };
  }
  if (l.moveInType) return { value: MOVE_IN_TYPE_LABEL[l.moveInType], sub: null };
  return { value: '협의', sub: null };
}

export function directionText(l: ListingDetail): { value: string; sub: string | null } | null {
  const d = l.property.direction;
  if (!d) return null;
  return {
    value: DIRECTION_LABEL[d],
    sub: l.property.directionBasis ? DIRECTION_BASIS_LABEL[l.property.directionBasis] : null,
  };
}

export function parkingText(l: ListingDetail): { value: string; sub: string | null } | null {
  const total = l.property.parkingSpaces;
  const per = l.complex?.parkingPerHousehold;
  if (per) return { value: `세대당 ${per}대`, sub: total ? `총 ${formatCount(total)}대` : null };
  if (total !== null && total !== undefined) {
    return { value: total > 0 ? `총 ${formatCount(total)}대` : '주차 불가', sub: null };
  }
  return null;
}

export interface Fact {
  key: string;
  icon: IconName;
  label: string;
  value: string;
  /** Second, non-wrapping half of the value ("/ 112.40㎡"). */
  valueTail?: string;
  sub?: string | null;
  /**
   * Narrow-screen variant — the mobile grid has room for one figure per cell (MobileListing):
   * "전용면적 84.98㎡ · 공급 112.4㎡" instead of "전용 / 공급 84.98㎡ / 112.4㎡".
   */
  compact?: { label: string; sub: string };
}

const areaBoth = (sqm: number, unit: AreaUnit) =>
  unit === 'sqm' ? formatSqm(sqm) : `${sqmToPyeong(sqm, 1)}평`;
const areaOther = (sqm: number, unit: AreaUnit) =>
  unit === 'sqm' ? `${sqmToPyeong(sqm, 1)}평` : formatSqm(sqm);

/**
 * 방 구성 label (원룸 · 1.5룸 · 투룸 · 쓰리룸+): the broker's stated `property.roomType`, else derived
 * from the room count for 원룸·투룸 listings (shared `effectiveRoomType`, same as the search filter).
 */
export function roomTypeText(l: ListingDetail): string | null {
  const type = effectiveRoomType(l.assetType, l.property.roomType, l.property.rooms);
  return type ? ROOM_TYPE_LABEL[type] : null;
}

/** The 8 headline facts of the grid (fewer for 토지 / 상가). */
export function buildFacts(l: ListingDetail, unit: AreaUnit): Fact[] {
  const p = l.property;
  const facts: Fact[] = [];
  if (p.exclusiveArea) {
    facts.push({
      key: 'area',
      icon: 'ruler',
      label: p.supplyArea ? '전용 / 공급' : '전용면적',
      value: areaBoth(p.exclusiveArea, unit),
      valueTail: p.supplyArea ? `/ ${areaBoth(p.supplyArea, unit)}` : undefined,
      sub: p.supplyArea
        ? `${areaOther(p.exclusiveArea, unit)} / ${areaOther(p.supplyArea, unit)}`
        : areaOther(p.exclusiveArea, unit),
      compact: p.supplyArea
        ? { label: '전용면적', sub: `공급 ${areaBoth(p.supplyArea, unit)}` }
        : undefined,
    });
  }
  if (p.landArea) {
    facts.push({
      key: 'land',
      icon: 'land',
      label: '대지면적',
      value: areaBoth(p.landArea, unit),
      sub: areaOther(p.landArea, unit),
    });
  }
  const roomType = roomTypeText(l);
  if (p.rooms !== null && p.rooms !== undefined) {
    facts.push({
      key: 'rooms',
      icon: 'room',
      label: '방 / 욕실',
      value: `${p.rooms}개 / ${p.baths ?? 0}개`,
      sub: roomType ? `방 구성 ${roomType}` : null,
      compact: roomType ? { label: '방 / 욕실', sub: roomType } : undefined,
    });
  } else if (roomType) {
    facts.push({ key: 'rooms', icon: 'room', label: '방 구성', value: roomType, sub: null });
  }
  const dir = directionText(l);
  if (dir) facts.push({ key: 'direction', icon: 'compass', label: '방향', ...dir });
  const floor = floorText(l);
  if (floor && l.assetType !== AssetType.LAND) {
    facts.push({
      key: 'floor',
      icon: 'building',
      label: '해당층 / 총층',
      value: floor.replace('/', ' / '),
      sub: l.floorDisplay === FloorDisplay.CLASS ? '저·중·고로 표시' : null,
    });
  }
  if (l.assetType !== AssetType.LAND) {
    const move = moveInText(l);
    facts.push({ key: 'movein', icon: 'calendar', label: '입주가능일', ...move });
    facts.push({
      key: 'fee',
      icon: 'info',
      label: '관리비',
      value:
        l.maintenanceFeeWon === null || l.maintenanceFeeWon === undefined
          ? '확인 필요'
          : l.maintenanceFeeWon === 0
            ? '없음'
            : `월 ${formatMaintenanceFee(l.maintenanceFeeWon)}`,
      sub: l.maintenanceFeeItems.length ? l.maintenanceFeeItems.slice(0, 3).join(' · ') : null,
    });
    const parking = parkingText(l);
    if (parking) facts.push({ key: 'parking', icon: 'key', label: '주차', ...parking });
    if (p.heatingType) {
      const m = /^(.*?)\s*\((.*)\)$/.exec(p.heatingType);
      facts.push({
        key: 'heating',
        icon: 'home',
        label: '난방',
        value: m?.[1] ?? p.heatingType,
        sub: m?.[2] ?? null,
      });
    }
  }
  if (p.zoning)
    facts.push({ key: 'zoning', icon: 'layers', label: '용도지역', value: p.zoning, sub: null });
  if (p.landCategory) {
    facts.push({
      key: 'category',
      icon: 'document',
      label: '지목',
      value: p.landCategory,
      sub: null,
    });
  }
  if (p.buildingUse) {
    facts.push({
      key: 'use',
      icon: 'store',
      label: '건축물 용도',
      value: p.buildingUse,
      sub: null,
    });
  }
  return facts;
}

export interface DisclosureRow {
  label: string;
  value: string;
}

/** 44500 → "4억 4,500만원", 30000 → "3억원", 65 → "65만원". */
function manwonWithUnit(manwon: number): string {
  const text = formatManwon(manwon);
  return text.endsWith('억') ? `${text}원` : `${text}만원`;
}

/** Drops words already used earlier in the line: "순천시 석현동 석현동 해오름빌" → "순천시 석현동 해오름빌". */
function dedupeWords(parts: readonly (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of parts.filter(Boolean).join(' ').split(/\s+/)) {
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out.join(' ');
}

/**
 * 소재지 for the 명시사항 list — 세부기준 asks for the address down to the 지번, plus 동 for 공동주택
 * (호수 may be omitted, and is never in the public payload). Uses the public address of the property
 * (지번 → 도로명 → 읍·면·동), then the complex / building name and 동.
 */
export function disclosureLocation(l: ListingDetail): string {
  const p = l.property;
  const address = (p.jibunAddress ?? p.roadAddress)
    ?.replace(/^(전남광주통합특별시|전라남도)\s*/, '')
    .trim();
  const name = l.complex?.name ?? (l.assetType === AssetType.LAND ? null : p.buildingName);
  return dedupeWords([address || regionLine(l), name, p.dong]);
}

/**
 * 공인중개사법 제18조의2 · 표시·광고 명시사항 세부기준의 중개대상물 항목 전부.
 * Missing values are shown as "확인 필요" rather than hidden so the list is always complete.
 */
/**
 * `now` (ms) decides "(예정)" for a future 사용승인일. The page passes its render time so the server
 * HTML and the client hydration of this client-rendered table agree (no time-dependent text).
 */
export function buildDisclosure(l: ListingDetail, now: number = Date.now()): DisclosureRow[] {
  const p = l.property;
  const missing = '확인 필요';
  const land = l.assetType === AssetType.LAND;
  const price = headlinePrice(l);
  const rows: DisclosureRow[] = [
    { label: '소재지', value: disclosureLocation(l) },
    { label: '중개대상물 종류', value: ASSET_TYPE_LABEL[l.assetType] },
    { label: '거래 형태', value: DEAL_TYPE_LABEL[l.dealType] },
    {
      label: '거래 금액',
      value:
        l.dealType === DealType.MONTHLY &&
        l.deposit !== null &&
        l.deposit !== undefined &&
        l.monthlyRent !== null &&
        l.monthlyRent !== undefined
          ? `보증금 ${l.deposit === 0 ? '없음' : manwonWithUnit(l.deposit)} / 월세 ${manwonWithUnit(l.monthlyRent)}`
          : price.text === '가격 협의'
            ? price.text
            : `${price.text}${price.unit}${price.note ? ` (${price.note})` : ''}`,
    },
  ];
  if (land) {
    rows.push({
      label: '면적',
      value: p.landArea ? `${formatSqm(p.landArea)} (${sqmToPyeong(p.landArea, 1)}평)` : missing,
    });
    if (p.landCategory) rows.push({ label: '지목', value: p.landCategory });
    if (p.zoning) rows.push({ label: '용도지역', value: p.zoning });
    return rows;
  }
  rows.push(
    {
      label: '면적',
      value: p.exclusiveArea
        ? [
            `전용 ${formatSqm(p.exclusiveArea)}`,
            p.supplyArea ? `공급 ${formatSqm(p.supplyArea)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : missing,
    },
    { label: '총 층수', value: p.totalFloors ? `${p.totalFloors}층` : missing },
    {
      label: '해당 층',
      value:
        l.floorDisplay === FloorDisplay.EXACT && p.floor !== null && p.floor !== undefined
          ? p.floor < 0
            ? `지하 ${Math.abs(p.floor)}층`
            : `${p.floor}층`
          : l.floorClass
            ? `${{ LOW: '저', MID: '중', HIGH: '고' }[l.floorClass]}층 (저·중·고 표시)`
            : missing,
    },
    {
      label: '사용승인일',
      value: p.approvalDate
        ? `${formatDate(p.approvalDate)}${Date.parse(p.approvalDate) > now ? ' (예정)' : ''}`
        : missing,
    },
    {
      label: '방향',
      value: p.direction
        ? `${DIRECTION_LABEL[p.direction]}${p.directionBasis ? ` (${DIRECTION_BASIS_LABEL[p.directionBasis]})` : ''}`
        : missing,
    },
    {
      label: '방 · 욕실 수',
      value:
        p.rooms !== null && p.rooms !== undefined
          ? `방 ${p.rooms}개 · 욕실 ${p.baths ?? 0}개`
          : p.baths
            ? `욕실 ${p.baths}개`
            : missing,
    },
    {
      label: '입주가능일',
      value: moveInText(l).sub?.replace(' · 협의 가능', '') ?? moveInText(l).value,
    },
    {
      label: '주차대수',
      value:
        p.parkingSpaces !== null && p.parkingSpaces !== undefined
          ? `총 ${formatCount(p.parkingSpaces)}대${l.complex?.parkingPerHousehold ? ` (세대당 ${l.complex.parkingPerHousehold}대)` : ''}`
          : missing,
    },
    {
      label: '관리비',
      value:
        l.maintenanceFeeWon === null || l.maintenanceFeeWon === undefined
          ? missing
          : l.maintenanceFeeWon === 0
            ? '없음'
            : `월 ${formatMaintenanceFee(l.maintenanceFeeWon)}${l.maintenanceFeeItems.length ? ` (${l.maintenanceFeeItems.join(', ')} 포함)` : ''}`,
    },
  );
  if (p.buildingUse) rows.push({ label: '건축물 용도', value: p.buildingUse });
  return rows;
}

export interface VerifyStep {
  method: VerificationMethod;
  title: string;
  shortTitle: string;
  sub: string;
}

const VERIFY_TITLE: Record<VerificationMethod, [string, string]> = {
  REGISTRY: ['등기부등본 대조', '등기부 대조'],
  OWNER_CALL: ['소유자 의뢰 확인', '소유자 확인'],
  SITE_VISIT: ['현장 방문 · 사진 촬영', '현장 촬영'],
  OWNER_CONFIRMED: ['소유자 확인', '소유자 확인'],
  DOCUMENT: ['서류 확인', '서류 확인'],
};

export function buildVerifySteps(l: ListingDetail): VerifyStep[] {
  return l.verifications.map((v) => {
    const [title, shortTitle] = VERIFY_TITLE[v.method] ?? [
      VERIFICATION_METHOD_LABEL[v.method],
      VERIFICATION_METHOD_LABEL[v.method],
    ];
    return {
      method: v.method,
      title,
      shortTitle,
      sub: [v.note, formatDateShort(v.verifiedAt)].filter(Boolean).join(' · '),
    };
  });
}

export interface Crumb {
  label: string;
  href?: string;
}

export function buildBreadcrumb(l: ListingDetail): Crumb[] {
  const slug = ASSET_SLUG[l.assetType];
  const crumbs: Crumb[] = [
    { label: '홈', href: ROUTES.home },
    { label: ASSET_NAV_LABEL[slug], href: ROUTES.map(slug) },
  ];
  const emd = l.property.emdName ?? l.complex?.emdName;
  if (emd) crumbs.push({ label: emd, href: mapHref(l) });
  if (l.complex) crumbs.push({ label: l.complex.name, href: ROUTES.complex(l.complex.id) });
  crumbs.push({
    label: [l.complex ? l.property.dong : listingName(l), DEAL_TYPE_LABEL[l.dealType]]
      .filter(Boolean)
      .join(' '),
  });
  return crumbs;
}

/** Map route centred on the listing (shareable URL state: c=lat,lng&z=zoom). */
export function mapHref(l: ListingDetail, zoom = 16): string {
  return `${ROUTES.map(ASSET_SLUG[l.assetType])}?c=${l.property.lat.toFixed(5)},${l.property.lng.toFixed(5)}&z=${zoom}`;
}

export function metaDescription(l: ListingDetail): string {
  const bits = [
    regionLine(l),
    `${ASSET_TYPE_LABEL[l.assetType]} ${priceLabel(l)}`,
    areaLabel(l),
    floorText(l),
    l.property.direction ? DIRECTION_LABEL[l.property.direction] : null,
    l.verifiedAt ? `실매물 확인 ${formatDateShort(l.verifiedAt)}` : null,
    l.agencies.length > 1 ? `중개사무소 ${l.agencies.length}곳 공동중개` : null,
  ].filter(Boolean);
  const lead = l.description?.split('\n')[0]?.trim();
  return `${bits.join(' · ')}.${lead ? ` ${lead}` : ''}`.slice(0, 160);
}

/** "전용 85㎡(26평) · 고/25층 · 남향" for cards / recent views (공급 only without 전용). */
export function summaryMeta(
  s: Pick<
    ListingSummary,
    'supplyArea' | 'exclusiveArea' | 'floor' | 'totalFloors' | 'floorClass' | 'direction'
  >,
): string[] {
  const area = s.exclusiveArea
    ? `전용 ${formatAreaPair(s.exclusiveArea)}`
    : s.supplyArea
      ? `공급 ${formatAreaPair(s.supplyArea)}`
      : null;
  const floor = formatFloor(
    s.floor !== null && s.floor !== undefined
      ? { floor: s.floor, totalFloors: s.totalFloors }
      : { floorClass: s.floorClass ?? null, totalFloors: s.totalFloors, showExact: false },
  );
  return [area, floor || null, s.direction ? DIRECTION_LABEL[s.direction] : null].filter(
    (v): v is string => !!v,
  );
}

export function statusNotice(l: Pick<ListingDetail, 'status'>): string | null {
  if (l.status === 'RESERVED')
    return '계약이 진행 중인 매물이에요. 거래가 끝나면 목록에서 내려갑니다.';
  if (l.status === 'CLOSED') return '거래가 완료된 매물이에요.';
  if (l.status === 'ACTIVE') return null;
  return `${LISTING_STATUS_LABEL[l.status]} 상태의 매물이에요.`;
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const displayPhone = (phone: string) => formatPhone(phone);

/** Description paragraphs: first line is the lead, blank lines are dropped. */
export function descriptionParagraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
