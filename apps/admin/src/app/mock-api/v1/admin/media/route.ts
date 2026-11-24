import { randomUUID } from 'node:crypto';
import { ALLOWED_IMAGE_MIME, MediaPurpose } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockRequireAdmin,
} from '@/lib/mock';
import { mediaStore, MOCK_MEDIA_LIMIT, sniffImageSize, toMediaDto } from './_store';

const MAX_BYTES = 10 * 1024 * 1024;
const PURPOSES = Object.values(MediaPurpose) as string[];

// POST /api/v1/admin/media?purpose=<MediaPurpose> (multipart `file`) → MediaDto (media README).
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const admin = mockRequireAdmin(req);
  if (admin instanceof Response) return admin;
  if (!mockCsrfOk(req)) return mockError(403, 'CSRF_INVALID', '보안 토큰이 올바르지 않습니다.');
  await mockDelay(req, 450);

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
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type))
    return mockError(415, 'MEDIA_UNSUPPORTED_TYPE', '지원하지 않는 파일 형식입니다.');
  if (file.size > MAX_BYTES) return mockError(413, 'MEDIA_TOO_LARGE', '파일 크기가 너무 큽니다.');

  const store = mediaStore();
  const uploads = [...store.values()].filter((m) => m.bytes);
  if (uploads.length >= MOCK_MEDIA_LIMIT) {
    const oldest = uploads.sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) store.delete(oldest.id);
  }
  const id = randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = sniffImageSize(bytes);
  const media = {
    id,
    purpose,
    mimeType: file.type,
    width: size?.width ?? null,
    height: size?.height ?? null,
    url: `/mock-api/v1/admin/media/${id}/file`,
    bytes,
    createdAt: Date.now(),
  };
  store.set(id, media);
  return mockJson(toMediaDto(media), { status: 201 });
}
