import { type AgencyDocumentView, type AgencyMemberView, type AgencySummary, type BusinessHours, type MyAgency } from '@house/shared';
import type { Prisma } from '@prisma/client';
import type { AgencyDocumentRow, AgencyMemberRow, AgencySummaryRow, MyAgencyRow } from './agency.selects';
import { type AgencyMediaPort, type MediaRef } from './ports/agency-media.port';
/** 홍길동 → 홍*동, 김철 → 김*: admin lists show who applied without the full name. */
export declare function maskName(name: string | null | undefined): string | null;
export declare function toBusinessHours(value: Prisma.JsonValue | null): BusinessHours | null;
export declare function toDocumentView(d: AgencyDocumentRow): AgencyDocumentView;
export declare function toMemberView(m: AgencyMemberRow): AgencyMemberView;
/** DB rows → API shapes. Explicit field picking: documents' storage keys never leave the API. */
export declare class AgencyMapper {
    private readonly media;
    constructor(media: AgencyMediaPort);
    logoUrl(logo: (MediaRef & {
        deletedAt: Date | null;
    }) | null): string | null;
    /** Cover (header) image: the wide `large` variant. */
    coverUrl(cover: (MediaRef & {
        deletedAt: Date | null;
    }) | null): string | null;
    summary(a: AgencySummaryRow): AgencySummary;
    mine(a: MyAgencyRow): MyAgency;
}
