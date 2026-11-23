import { z } from 'zod';
import { MediaPurpose, MediaStatus, MediaVisibility } from '../enums/media';
import { csvArray, idSchema, paginationQuerySchema, queryBoolean } from '../schemas/common';

/** `GET /media` — the caller's own uploads. */
export const myMediaListQuerySchema = paginationQuerySchema.extend({
  purpose: csvArray(z.enum(MediaPurpose)),
  status: csvArray(z.enum(MediaStatus)),
});
export type MyMediaListQuery = z.infer<typeof myMediaListQuerySchema>;

/** `GET /admin/media` — every upload. `orphaned=true` lists unattached uploads only. */
export const adminMediaListQuerySchema = paginationQuerySchema.extend({
  purpose: csvArray(z.enum(MediaPurpose)),
  status: csvArray(z.enum(MediaStatus)),
  visibility: z.enum(MediaVisibility).optional(),
  ownerUserId: idSchema.optional(),
  ownerAdminId: idSchema.optional(),
  orphaned: queryBoolean,
  includeDeleted: queryBoolean,
});
export type AdminMediaListQuery = z.infer<typeof adminMediaListQuerySchema>;
