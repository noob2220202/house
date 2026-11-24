import { AgencyDocumentType, DealType, formatManwon, sqmToPyeong } from '@house/shared';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';

/**
 * Documents an application needs before it can be approved — the admin app's
 * `REQUIRED_AGENCY_DOCUMENTS` (m-moderation/lib/labels.ts).
 */
export const REQUIRED_AGENCY_DOCUMENTS: readonly AgencyDocumentType[] = [
  AgencyDocumentType.REGISTRATION_CERT,
  AgencyDocumentType.BUSINESS_REG_CERT,
];

export function documentChecklist(types: readonly AgencyDocumentType[]): {
  submitted: number;
  required: number;
  missing: AgencyDocumentType[];
  missingLabel: string | null;
} {
  const have = new Set(types);
  const missing = REQUIRED_AGENCY_DOCUMENTS.filter((t) => !have.has(t));
  return {
    submitted: REQUIRED_AGENCY_DOCUMENTS.length - missing.length,
    required: REQUIRED_AGENCY_DOCUMENTS.length,
    missing,
    missingLabel: null,
  };
}

/** "김서진" → "김*진", "한결" → "한*" (search results never show a member's full name). */
export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  const chars = [...name.trim()];
  if (chars.length <= 1) return chars.join('') || null;
  return chars.length === 2
    ? `${chars[0]}*`
    : `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

type Decimalish = Prisma.Decimal | number | null | undefined;
const toNumber = (d: Decimalish): number | null => (d == null ? null : Number(d));

/** "34평" from an exclusive area in ㎡ (null when unknown). */
export function pyeongLabel(area: Decimalish): string | null {
  const sqm = toNumber(area);
  return sqm && sqm > 0 ? `${Math.round(sqmToPyeong(sqm))}평` : null;
}

/** The price triple the admin app shows for a deal type (만원). */
export function priceFields(
  dealType: DealType,
  p: {
    salePrice?: number | null;
    presalePrice?: number | null;
    deposit?: number | null;
    monthlyRent?: number | null;
  },
): { price: number | null; deposit: number | null; monthlyRent: number | null } {
  switch (dealType) {
    case DealType.SALE:
      return { price: p.salePrice ?? null, deposit: null, monthlyRent: null };
    case DealType.PRESALE:
      return { price: p.presalePrice ?? p.salePrice ?? null, deposit: null, monthlyRent: null };
    case DealType.JEONSE:
      return { price: null, deposit: p.deposit ?? null, monthlyRent: null };
    default:
      return { price: null, deposit: p.deposit ?? null, monthlyRent: p.monthlyRent ?? null };
  }
}

/** "매매 3억 1,000" / "월세 2,000/65" — short price text for notification bodies. */
export function priceText(
  dealType: DealType,
  p: Parameters<typeof priceFields>[1],
  labels: Record<DealType, string>,
): string | null {
  const f = priceFields(dealType, p);
  const label = labels[dealType];
  if (f.price != null) return `${label} ${formatManwon(f.price)}`;
  if (f.deposit != null && f.monthlyRent != null) {
    return `${label} ${f.deposit.toLocaleString('ko-KR')}/${f.monthlyRent.toLocaleString('ko-KR')}`;
  }
  if (f.deposit != null) return `${label} ${formatManwon(f.deposit)}`;
  return null;
}

/**
 * Human headline of a listing: its title when the agency wrote one, else
 * "<complex | building | road address> · <평형>".
 */
export function listingHeadline(l: {
  title: string | null;
  exclusiveArea?: Decimalish;
  complex?: { name: string } | null;
  property?: { buildingName: string | null; roadAddress: string } | null;
}): string {
  if (l.title?.trim()) return l.title.trim();
  const place = l.complex?.name ?? l.property?.buildingName ?? l.property?.roadAddress ?? '매물';
  const size = pyeongLabel(l.exclusiveArea);
  return size ? `${place} · ${size}` : place;
}

/** 읍면동 / 리 names for a set of region codes (one query). */
export async function regionNames(
  db: PrismaTx,
  codes: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(codes.filter((c): c is string => Boolean(c)))];
  if (unique.length === 0) return new Map();
  const rows = await db.region.findMany({
    where: { code: { in: unique } },
    select: { code: true, name: true },
  });
  return new Map(rows.map((r) => [r.code, r.name]));
}
