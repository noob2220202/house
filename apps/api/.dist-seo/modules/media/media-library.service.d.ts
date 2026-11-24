import type { ReadStream } from 'node:fs';
import { type AdminMediaListQuery, type AdminMediaView, type MediaView, type MyMediaListQuery, type OwnMediaView, type Paginated } from '@house/shared';
import { type Principal, type UserPrincipal } from '../../common/auth/principal';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaFiles } from './media-files';
import { MediaStorage } from './media-storage';
import { MediaMapper } from './media.mapper';
export interface MediaFileStream {
    stream: ReadStream;
    mimeType: string;
    sizeBytes: number;
    /** ASCII-only download name (never the user-supplied one). */
    filename: string;
}
/** Reading, listing, streaming and deleting uploads (user + admin side). */
export declare class MediaLibraryService {
    private readonly prisma;
    private readonly storage;
    private readonly files;
    private readonly mapper;
    private readonly logger;
    constructor(prisma: PrismaService, storage: MediaStorage, files: MediaFiles, mapper: MediaMapper);
    listMine(user: UserPrincipal, q: MyMediaListQuery): Promise<Paginated<OwnMediaView>>;
    /**
     * Owners see their uploads in any state; everyone else only READY public media of purposes that
     * are not owner-only (deal-request photos are shown through the deal-requests module).
     */
    getForViewer(id: string, principal: Principal | undefined): Promise<MediaView>;
    /**
     * A private file for its uploader, or for staff (AGENT/AGENCY_OWNER) of the agency it is
     * attached to as a document. Anyone else gets 404.
     */
    openPrivate(id: string, user: UserPrincipal): Promise<MediaFileStream>;
    listAll(q: AdminMediaListQuery): Promise<Paginated<AdminMediaView>>;
    getForAdmin(id: string): Promise<AdminMediaView>;
    openForAdmin(id: string): Promise<MediaFileStream>;
    deleteMine(id: string, user: UserPrincipal): Promise<void>;
    deleteAsAdmin(id: string): Promise<AdminMediaView>;
    /**
     * Soft-deletes an unattached upload and removes its files right away (the row is purged by the
     * cleanup job later). The row is locked FOR UPDATE so a concurrent attach (FOR SHARE) either
     * finishes first — and the delete is refused — or waits and then sees the row deleted.
     */
    private softDelete;
    private open;
    private page;
}
