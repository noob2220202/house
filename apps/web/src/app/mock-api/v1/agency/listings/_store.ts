import {
  DealType,
  FloorDisplay,
  ListingStatus,
  listingDraftSchema,
  listingUpdateSchema,
  type ListingDraftInput,
} from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import type {
  AgencyListing,
  AgencyListingAgency,
  AgencyListingItem,
  AgencyListingSummary,
  CoBrokerCandidate,
} from '@/features/a-listings/api/schemas';
import { draftOfListing } from '@/features/a-listings/lib/form';
import { publishAgencyOf } from '@/features/a-listings/lib/preview';
import { missingRequirements, publishIssues } from '@/features/a-listings/lib/requirements';
import { isVerificationDue } from '@/features/a-listings/lib/status';
import { floorClassOf } from '@/lib/format';
import {
  mockCsrfOk,
  mockError,
  mockForbidden,
  mockGuard,
  mockSessionRole,
  mockUnauthenticated,
  type MockRole,
} from '@/lib/mock';
import { agencyState } from '../../agencies/mine/_store';
import { findComplexSpec } from '../../complexes/_fixtures';
import {
  MY_OFFICE_CODE,
  MY_OFFICE_ID,
  otherOffice,
  seedListings,
  type StoredListing,
} from './_fixtures';

/**
 * In-memory state of the broker-side listings mock (a-listings). Kept on `globalThis` because every
 * route handler is compiled into its own module graph; it resets when the dev server restarts.
 */
interface ListingsMockState {
  listings: StoredListing[];
  seq: number;
}
const KEY = '__houseMockAgencyListings_v1';

export function listingsState(): ListingsMockState {
  const g = globalThis as typeof globalThis & { [KEY]?: ListingsMockState };
  g[KEY] ??= { listings: seedListings(), seq: 430 };
  return g[KEY];
}

export interface ListingsContext {
  role: Exclude<MockRole, 'USER'>;
  isOwner: boolean;
  state: ListingsMockState;
}

/** Common preamble: mock guard → session (AGENT / AGENCY_OWNER) → CSRF for mutations. */
export function listingsContext(
  req: NextRequest,
  options: { mutation?: boolean; ownerOnly?: boolean } = {},
): NextResponse | ListingsContext {
  const off = mockGuard();
  if (off) return off;
  const role = mockSessionRole(req);
  if (!role) return mockUnauthenticated();
  if (role === 'USER') return mockForbidden();
  if (options.mutation && !mockCsrfOk(req)) {
    return mockError(403, 'CSRF_TOKEN_INVALID', '요청을 확인할 수 없습니다.');
  }
  if (options.ownerOnly && role !== 'AGENCY_OWNER') {
    return mockError(403, 'FORBIDDEN', '대표(개업공인중개사)만 할 수 있는 작업입니다.');
  }
  return { role, isOwner: role === 'AGENCY_OWNER', state: listingsState() };
}

export const listingNotFound = () =>
  mockError(404, 'LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
export const notMember = () =>
  mockError(403, 'LISTING_NOT_AGENCY_MEMBER', '해당 매물을 관리하는 중개사무소 소속이 아닙니다.');
export const invalidTransition = () =>
  mockError(409, 'LISTING_INVALID_STATUS_TRANSITION', '현재 상태에서는 변경할 수 없습니다.');

export const isMine = (l: StoredListing) => l.offices.includes(MY_OFFICE_CODE);
export const isPrimaryMine = (l: StoredListing) => l.offices[0] === MY_OFFICE_CODE;

/** Finds any listing by UUID or fixture code. */
export function findListing(state: ListingsMockState, idOrCode: string): StoredListing | undefined {
  const key = idOrCode.toLowerCase();
  return state.listings.find((l) => l.id === idOrCode || l.code.toLowerCase() === key);
}

function officeDisclosure(code: string, isPrimary: boolean): AgencyListingAgency | null {
  if (code === MY_OFFICE_CODE) {
    const o = agencyState().office;
    return {
      agencyId: MY_OFFICE_ID,
      isPrimary,
      name: o.name,
      representativeName: o.representativeName,
      registrationNumber: o.registrationNumber,
      phone: o.phone,
      roadAddress: o.roadAddress,
      addressDetail: o.addressDetail ?? null,
      logoUrl: o.logo?.variants.thumb?.url ?? null,
      contactName: o.representativeName,
      contactPhone: o.mobile ?? o.phone,
    };
  }
  const other = otherOffice(code);
  return other ? { ...other, isPrimary } : null;
}

/** API view of a stored listing (agencies resolved live, flags relative to the mock office). */
export function toView(l: StoredListing): AgencyListing & { isPrimaryAgency: boolean } {
  const { code: _code, offices, ...rest } = l;
  return {
    ...rest,
    isPrimary: isPrimaryMine(l),
    // The API's name of the flag (`AgencyListingDetail.isPrimaryAgency`).
    isPrimaryAgency: isPrimaryMine(l),
    version: l.version ?? 0,
    agencies: offices
      .map((c, i) => officeDisclosure(c, i === 0))
      .filter((a): a is AgencyListingAgency => a !== null),
  };
}

function nameOf(l: StoredListing): string {
  return (
    l.complex?.name ?? l.property.buildingName ?? l.property.roadAddress.replace(/^전라남도\s*/, '')
  );
}

function summaryFields(l: StoredListing) {
  const p = l.property;
  return {
    id: l.id,
    listingNo: l.listingNo ?? null,
    status: l.status,
    dealType: l.dealType,
    assetType: p.assetType,
    name: nameOf(l),
    dong: p.dong ?? null,
    salePrice: l.salePrice ?? null,
    deposit: l.deposit ?? null,
    monthlyRent: l.monthlyRent ?? null,
    presalePrice: l.presalePrice ?? null,
    premium: l.premium ?? null,
    exclusiveArea: p.exclusiveArea ?? null,
    supplyArea: p.supplyArea ?? null,
    floor: p.floor ?? null,
    totalFloors: p.totalFloors ?? null,
    floorClass:
      typeof p.floor === 'number' && typeof p.totalFloors === 'number'
        ? floorClassOf(p.floor, p.totalFloors)
        : null,
    direction: p.direction ?? null,
    coverPhotoUrl: (l.photos.find((x) => x.isCover) ?? l.photos[0])?.thumbUrl ?? null,
    verifiedAt: l.verifiedAt ?? null,
    publishedAt: l.publishedAt ?? null,
    agencyCount: l.offices.length,
  };
}

export function toItem(l: StoredListing): AgencyListingItem {
  const primary = officeDisclosure(l.offices[0] ?? MY_OFFICE_CODE, true);
  return {
    ...summaryFields(l),
    ho: l.property.ho ?? null,
    title: l.title ?? null,
    landArea: l.property.landArea ?? null,
    photoCount: l.photos.length,
    verificationDueAt: l.verificationDueAt ?? null,
    expiresAt: l.expiresAt ?? null,
    updatedAt: l.updatedAt ?? null,
    hiddenReason: l.hiddenReason ?? null,
    viewCount: l.viewCount,
    favoriteCount: l.favoriteCount,
    inquiryCount: l.inquiryCount,
    isPrimary: isPrimaryMine(l),
    primaryAgencyName: isPrimaryMine(l) ? null : (primary?.name ?? null),
    missingCount:
      l.status === ListingStatus.DRAFT ? missingRequirements(draftOfListing(l)).length : null,
  };
}

/**
 * Candidate row for OTHER offices: public fields only — no 호수, and no exact floor when the primary
 * office shows 저/중/고 at the client's request (floorClass stays).
 */
export function toCandidate(l: StoredListing): CoBrokerCandidate {
  const primary = officeDisclosure(l.offices[0] ?? '', true);
  const summary = summaryFields(l);
  return {
    ...summary,
    floor: l.floorDisplay === FloorDisplay.CLASS ? null : summary.floor,
    primaryAgencyName: primary?.name ?? '중개사무소',
    joined: isMine(l),
  };
}

const DAY = 86_400_000;
export function isExpiringSoon(l: StoredListing, now = Date.now()): boolean {
  if (l.status !== ListingStatus.ACTIVE || !l.expiresAt) return false;
  const left = Date.parse(l.expiresAt) - now;
  return left > 0 && left <= 7 * DAY;
}

export function summarize(state: ListingsMockState): AgencyListingSummary {
  const mine = state.listings.filter(isMine);
  const byStatus = { DRAFT: 0, ACTIVE: 0, RESERVED: 0, CLOSED: 0, HIDDEN: 0 };
  for (const l of mine) byStatus[l.status] += 1;
  return {
    total: mine.length,
    byStatus,
    verificationDue: mine.filter((l) => isVerificationDue(l)).length,
    expiringSoon: mine.filter((l) => isExpiringSoon(l)).length,
    coBrokered: mine.filter((l) => !isPrimaryMine(l)).length,
  };
}

/** Sort key in 만원 (Listing.priceSort). */
export function priceSortOf(l: StoredListing): number {
  if (l.dealType === DealType.SALE) return l.salePrice ?? 0;
  if (l.dealType === DealType.PRESALE) return (l.presalePrice ?? 0) + (l.premium ?? 0);
  return l.deposit ?? 0;
}

// ---- writes ---------------------------------------------------------------------------------------

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function validationError(
  issues: readonly { path: PropertyKey[]; message: string }[],
): NextResponse {
  return mockError(
    400,
    'VALIDATION_FAILED',
    '입력 내용을 확인해 주세요.',
    issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  );
}

/** Parses a POST / PATCH body with the shared draft schema. */
export function parseDraft(body: unknown): { data: ListingDraftInput } | { error: NextResponse } {
  const parsed = listingDraftSchema.safeParse(body);
  return parsed.success ? { data: parsed.data } : { error: validationError(parsed.error.issues) };
}

const n = <T>(v: T | undefined): T | null => v ?? null;

/**
 * PATCH body (`listingUpdateSchema`: omitted = unchanged, null = cleared) merged onto the stored
 * listing → the full draft, validated again with the draft schema (like the API's merged check).
 */
export function mergeUpdate(
  l: StoredListing,
  body: unknown,
): { data: ListingDraftInput } | { error: NextResponse } {
  const parsed = listingUpdateSchema.safeParse(body);
  if (!parsed.success) return { error: validationError(parsed.error.issues) };
  const { version, property, ...fields } = parsed.data;
  if (typeof version === 'number' && version !== (l.version ?? 0)) {
    return {
      error: mockError(
        409,
        'LISTING_CONCURRENT_MODIFICATION',
        '다른 곳에서 먼저 수정되었습니다. 새로고침 후 다시 시도해 주세요.',
      ),
    };
  }
  const current = draftOfListing(l) as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  const mergedProperty: Record<string, unknown> = {
    ...(current.property as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(property ?? {})) {
    if (value === undefined) continue;
    if (value === null) delete mergedProperty[key];
    else mergedProperty[key] = value;
  }
  merged.property = mergedProperty;
  return parseDraft(merged);
}

/** Applies a full draft (omitted optional fields are cleared) to a stored listing. */
export function applyDraft(l: StoredListing, d: ListingDraftInput): void {
  const p = d.property;
  const spec = p.complexId ? findComplexSpec(p.complexId) : undefined;
  l.dealType = d.dealType;
  l.title = n(d.title);
  l.description = n(d.description);
  l.salePrice = n(d.salePrice);
  l.deposit = n(d.deposit);
  l.monthlyRent = n(d.monthlyRent);
  l.presalePrice = n(d.presalePrice);
  l.premium = n(d.premium);
  l.maintenanceFeeWon = n(d.maintenanceFeeWon);
  l.maintenanceFee = d.maintenanceFee
    ? {
        billingType: d.maintenanceFee.billingType,
        items: d.maintenanceFee.items.map((i) => ({
          kind: i.kind,
          included: i.included,
          amountWon: i.amountWon ?? null,
        })),
        unavailableReason: d.maintenanceFee.unavailableReason ?? null,
      }
    : null;
  l.moveInType = n(d.moveInType);
  l.moveInDate = n(d.moveInDate);
  l.floorDisplay = d.floorDisplay;
  l.options = d.options;
  l.property = {
    assetType: p.assetType,
    complexId: spec ? n(p.complexId) : null,
    areaTypeId: spec ? n(p.areaTypeId) : null,
    roadAddress: p.roadAddress,
    jibunAddress: n(p.jibunAddress),
    buildingName: n(p.buildingName),
    dong: n(p.dong),
    ho: n(p.ho),
    // The API keeps the sent 법정동코드 (the address lookup's / the complex's).
    emdCode: p.emdCode ?? spec?.emdCode ?? null,
    emdName: spec?.emdName ?? emdNameOf(p.jibunAddress ?? p.roadAddress),
    lat: p.lat,
    lng: p.lng,
    floor: n(p.floor),
    totalFloors: n(p.totalFloors),
    exclusiveArea: n(p.exclusiveArea),
    supplyArea: n(p.supplyArea),
    landArea: n(p.landArea),
    rooms: n(p.rooms),
    baths: n(p.baths),
    direction: n(p.direction),
    directionBasis: n(p.directionBasis),
    approvalDate: n(p.approvalDate),
    parkingSpaces: n(p.parkingSpaces),
    buildingUse: n(p.buildingUse),
  };
  l.version = (l.version ?? 0) + 1;
  l.complex = spec ? { id: p.complexId as string, name: spec.name, emdName: spec.emdName } : null;
  l.updatedAt = new Date().toISOString();
}

/** "전라남도 순천시 해룡면 신대리 2011" → "해룡면 신대리"; "… 석현동 대학로 15" → "석현동". */
function emdNameOf(address: string): string | null {
  const parts = address
    .replace(/^전라남도\s*/, '')
    .replace(/^순천시\s*/, '')
    .split(/\s+/);
  const out: string[] = [];
  for (const part of parts) {
    if (/(읍|면|동|리)$/.test(part)) out.push(part);
    else break;
  }
  return out.length > 0 ? out.join(' ') : null;
}

/**
 * The API's publish validator: shared `checkPublishRequirements` over the listing and its primary
 * office → 400 `LISTING_PUBLISH_REQUIREMENTS` with `details: [{ field, label }]`.
 */
export function publishRequirementsError(l: StoredListing): NextResponse | null {
  const primary = officeDisclosure(l.offices[0] ?? MY_OFFICE_CODE, true) ?? undefined;
  const issues = publishIssues(draftOfListing(l), publishAgencyOf(primary));
  if (issues.length === 0) return null;
  return mockError(
    400,
    'LISTING_PUBLISH_REQUIREMENTS',
    '광고 게시에 필요한 필수 표시사항이 누락되었습니다.',
    // The API sends `{ field, label }` only (no `message`): the console builds its own text.
    issues.map((i) => ({ field: i.field, label: i.label })) as unknown as { message: string }[],
  );
}

export function nextListingNo(state: ListingsMockState): string {
  state.seq += 1;
  return `26-${String(state.seq).padStart(4, '0')}`;
}
