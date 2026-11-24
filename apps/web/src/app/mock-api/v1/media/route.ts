import { randomUUID } from 'node:crypto';
import { ALLOWED_DOCUMENT_MIME, ALLOWED_IMAGE_MIME, MediaPurpose } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockSessionRole,
  mockUnauthenticated,
} from '@/lib/mock';
import { mediaDto, mediaStore, MOCK_MEDIA_LIMIT } from './_store';

const MAX_BYTES = 10 * 1024 * 1024;
const PURPOSES = Object.values(MediaPurpose) as string[];

// POST /api/v1/media?purpose=<MediaPurpose> (multipart `file`) → MediaDto
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockSessionRole(req)) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(403, 'CSRF_FAILED', '보안 토큰이 올바르지 않습니다.');
  await mockDelay(req, 500);

  const purpose = req.nextUrl.searchParams.get('purpose') ?? '';
  if (!PURPOSES.includes(purpose))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'purpose', message: '올바른 업로드 용도가 아닙니다.' },
    ]);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'file', message: '파일을 선택해 주세요.' },
    ]);
  const allowed: readonly string[] =
    purpose === MediaPurpose.AGENCY_DOCUMENT ? ALLOWED_DOCUMENT_MIME : ALLOWED_IMAGE_MIME;
  if (!allowed.includes(file.type))
    return mockError(415, 'MEDIA_UNSUPPORTED_TYPE', '지원하지 않는 파일 형식입니다.');
  if (file.size > MAX_BYTES)
    return mockError(413, 'MEDIA_TOO_LARGE', '파일 용량이 너무 큽니다. (최대 10MB)');

  const store = mediaStore();
  if (store.size >= MOCK_MEDIA_LIMIT) {
    const oldest = [...store.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) store.delete(oldest.id);
  }
  const id = randomUUID();
  store.set(id, {
    id,
    purpose,
    mimeType: file.type,
    fileName: file.name || 'upload',
    bytes: new Uint8Array(await file.arrayBuffer()),
    createdAt: Date.now(),
  });
  return mockJson(mediaDto(id), { status: 201 });
}
