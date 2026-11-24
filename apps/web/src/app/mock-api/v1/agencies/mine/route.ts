import { agencyUpdateSchema, ERROR_MESSAGES, ErrorCode, MediaPurpose } from '@house/shared';
import type { NextRequest } from 'next/server';
import type { Media } from '@/features/a-agency/api/schemas';
import { mockDelay, mockError, mockForbidden, mockJson } from '@/lib/mock';
import { mediaDto } from '../../media/_store';
import {
  agencyContext,
  agencyNotFound,
  forViewer,
  readJson,
  saveAgency,
  validationError,
} from './_store';

// GET /api/v1/agencies/mine — the caller's agency incl. private fields; 404 when there is none.
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req);
  if (!ctx.agency) return agencyNotFound();
  return mockJson(forViewer(ctx.agency, ctx.isOwner));
}

/**
 * Validates exactly like the API would: the shared `agencyUpdateSchema` (so a `null` intro, an
 * empty mobile or a missing `specialties` behave as they will for real). `mobile: null`,
 * `businessHours`, `logoMediaId` (AGENCY_LOGO) and `coverMediaId` (AGENCY_COVER) are all part of it.
 */
const patchSchema = agencyUpdateSchema;

const IMAGE_PURPOSE = {
  logo: { purpose: MediaPurpose.AGENCY_LOGO, code: ErrorCode.AGENCY_LOGO_INVALID },
  cover: { purpose: MediaPurpose.AGENCY_COVER, code: ErrorCode.AGENCY_COVER_INVALID },
} as const;

// PATCH /api/v1/agencies/mine — AGENCY_OWNER only.
export async function PATCH(req: NextRequest) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 450);
  if (!ctx.agency) return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  if (ctx.agency.status !== 'APPROVED') {
    return mockError(403, 'AGENCY_NOT_APPROVED', '승인된 중개사무소만 이용할 수 있습니다.');
  }
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const { logoMediaId, coverMediaId, ...fields } = parsed.data;

  const next = { ...ctx.agency, ...fields };
  for (const [key, mediaId] of [
    ['logo', logoMediaId],
    ['cover', coverMediaId],
  ] as const) {
    if (mediaId === undefined) continue;
    if (mediaId === null) {
      next[key] = null;
      continue;
    }
    const media = mediaDto(mediaId);
    if (!media) {
      return mockError(400, 'VALIDATION_FAILED', '업로드한 이미지를 찾을 수 없습니다.', [
        { path: `${key}MediaId`, message: '업로드한 이미지를 찾을 수 없습니다.' },
      ]);
    }
    // Like the API: the logo must be an AGENCY_LOGO upload, the cover an AGENCY_COVER upload.
    if (media.purpose !== IMAGE_PURPOSE[key].purpose) {
      const { code } = IMAGE_PURPOSE[key];
      return mockError(400, code, ERROR_MESSAGES[code]);
    }
    next[key] = media as Media;
  }
  return mockJson(saveAgency(ctx, next));
}
