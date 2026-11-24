import { AgencyDocumentType } from '@house/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { mockDelay, mockError, mockForbidden, mockGuard, mockJson } from '@/lib/mock';
import { mediaStore } from '../../../media/_store';
import {
  agencyContext,
  agencyNotFound,
  mockId,
  readJson,
  saveAgency,
  validationError,
} from '../_store';

const bodySchema = z.object({
  type: z.enum(AgencyDocumentType),
  mediaId: z.string().min(1),
  /** Original file name, display only. */
  fileName: z.string().trim().max(200).optional(),
});

/**
 * POST /api/v1/agencies/mine/documents — attach an uploaded private file (Media purpose
 * AGENCY_DOCUMENT) to the caller's agency. Body (ASSUMED): `{ type, mediaId, fileName? }` → AgencyDocument.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  // Delay first, then read the state: parallel uploads must not overwrite each other's append.
  await mockDelay(req, 250);
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  if (!ctx.agency) return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const media = mediaStore().get(parsed.data.mediaId);
  if (!media || media.purpose !== 'AGENCY_DOCUMENT') {
    return mockError(400, 'VALIDATION_FAILED', '업로드한 서류를 찾을 수 없습니다.', [
      { path: 'mediaId', message: '업로드한 서류를 찾을 수 없습니다.' },
    ]);
  }
  const doc = {
    id: mockId('doc'),
    type: parsed.data.type,
    mediaId: media.id,
    mimeType: media.mimeType,
    fileName: parsed.data.fileName ?? null,
    createdAt: new Date().toISOString(),
  };
  saveAgency(ctx, { ...ctx.agency, documents: [...ctx.agency.documents, doc] });
  return mockJson(doc, { status: 201 });
}
