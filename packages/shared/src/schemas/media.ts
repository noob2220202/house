// Owned by the media module team.
import { z } from 'zod';
import { MediaPurpose } from '../enums/media';

/** `POST /media?purpose=` and `POST /admin/media?purpose=` (multipart field `file`). */
export const mediaUploadQuerySchema = z.object({
  purpose: z.enum(MediaPurpose),
});
export type MediaUploadQuery = z.infer<typeof mediaUploadQuerySchema>;

// Views and list queries live in src/media (MediaView, OwnMediaView, AdminMediaView, …).
export type { MediaVariantView as MediaVariantDto, MediaView as MediaDto } from '../media/types';
