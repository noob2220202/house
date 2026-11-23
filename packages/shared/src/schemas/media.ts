// Owned by the media module team.
import { z } from 'zod';
import { MediaPurpose } from '../enums/media';

export const mediaUploadQuerySchema = z.object({
  purpose: z.enum(MediaPurpose),
});

export interface MediaVariantDto {
  url: string;
  width: number;
  height: number;
}

export interface MediaDto {
  id: string;
  purpose: MediaPurpose;
  mimeType: string;
  width: number | null;
  height: number | null;
  variants: Partial<Record<'thumb' | 'medium' | 'large', MediaVariantDto>>;
}
