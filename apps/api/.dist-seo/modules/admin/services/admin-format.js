"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_AGENCY_DOCUMENTS = void 0;
exports.documentChecklist = documentChecklist;
exports.maskName = maskName;
exports.pyeongLabel = pyeongLabel;
exports.priceFields = priceFields;
exports.priceText = priceText;
exports.listingHeadline = listingHeadline;
exports.regionNames = regionNames;
const shared_1 = require("@house/shared");
/**
 * Documents an application needs before it can be approved — the admin app's
 * `REQUIRED_AGENCY_DOCUMENTS` (m-moderation/lib/labels.ts).
 */
exports.REQUIRED_AGENCY_DOCUMENTS = [
    shared_1.AgencyDocumentType.REGISTRATION_CERT,
    shared_1.AgencyDocumentType.BUSINESS_REG_CERT,
];
function documentChecklist(types) {
    const have = new Set(types);
    const missing = exports.REQUIRED_AGENCY_DOCUMENTS.filter((t) => !have.has(t));
    return {
        submitted: exports.REQUIRED_AGENCY_DOCUMENTS.length - missing.length,
        required: exports.REQUIRED_AGENCY_DOCUMENTS.length,
        missing,
        missingLabel: null,
    };
}
/** "김서진" → "김*진", "한결" → "한*" (search results never show a member's full name). */
function maskName(name) {
    if (!name)
        return null;
    const chars = [...name.trim()];
    if (chars.length <= 1)
        return chars.join('') || null;
    return chars.length === 2
        ? `${chars[0]}*`
        : `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}
const toNumber = (d) => (d == null ? null : Number(d));
/** "34평" from an exclusive area in ㎡ (null when unknown). */
function pyeongLabel(area) {
    const sqm = toNumber(area);
    return sqm && sqm > 0 ? `${Math.round((0, shared_1.sqmToPyeong)(sqm))}평` : null;
}
/** The price triple the admin app shows for a deal type (만원). */
function priceFields(dealType, p) {
    switch (dealType) {
        case shared_1.DealType.SALE:
            return { price: p.salePrice ?? null, deposit: null, monthlyRent: null };
        case shared_1.DealType.PRESALE:
            return { price: p.presalePrice ?? p.salePrice ?? null, deposit: null, monthlyRent: null };
        case shared_1.DealType.JEONSE:
            return { price: null, deposit: p.deposit ?? null, monthlyRent: null };
        default:
            return { price: null, deposit: p.deposit ?? null, monthlyRent: p.monthlyRent ?? null };
    }
}
/** "매매 3억 1,000" / "월세 2,000/65" — short price text for notification bodies. */
function priceText(dealType, p, labels) {
    const f = priceFields(dealType, p);
    const label = labels[dealType];
    if (f.price != null)
        return `${label} ${(0, shared_1.formatManwon)(f.price)}`;
    if (f.deposit != null && f.monthlyRent != null) {
        return `${label} ${f.deposit.toLocaleString('ko-KR')}/${f.monthlyRent.toLocaleString('ko-KR')}`;
    }
    if (f.deposit != null)
        return `${label} ${(0, shared_1.formatManwon)(f.deposit)}`;
    return null;
}
/**
 * Human headline of a listing: its title when the agency wrote one, else
 * "<complex | building | road address> · <평형>".
 */
function listingHeadline(l) {
    if (l.title?.trim())
        return l.title.trim();
    const place = l.complex?.name ?? l.property?.buildingName ?? l.property?.roadAddress ?? '매물';
    const size = pyeongLabel(l.exclusiveArea);
    return size ? `${place} · ${size}` : place;
}
/** 읍면동 / 리 names for a set of region codes (one query). */
async function regionNames(db, codes) {
    const unique = [...new Set(codes.filter((c) => Boolean(c)))];
    if (unique.length === 0)
        return new Map();
    const rows = await db.region.findMany({
        where: { code: { in: unique } },
        select: { code: true, name: true },
    });
    return new Map(rows.map((r) => [r.code, r.name]));
}
//# sourceMappingURL=admin-format.js.map