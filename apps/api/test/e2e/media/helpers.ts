import { rm } from 'node:fs/promises';
import path from 'node:path';
import { HEADER_NAMES, type OwnMediaView } from '@house/shared';
import type { Test } from 'supertest';
import { MediaProcessingService } from '../../../src/modules/media/media-processing.service';
import {
  HEIC_DECODER,
  type HeicDecoder,
  type RawImage,
} from '../../../src/modules/media/ports/heic-decoder.port';
import { AppException } from '../../../src/common/errors/app.exception';
import { createTestApp, withSession, type TestApp, type TestSession } from '../../utils';

/** Controllable HEIC decoder (the real one needs a libvips with libde265). */
export class FakeHeicDecoder implements HeicDecoder {
  supported = true;
  next: RawImage | AppException = solidRaw(80, 60);

  decode(): Promise<RawImage> {
    const r = this.next;
    return r instanceof AppException ? Promise.reject(r) : Promise.resolve(r);
  }
}

export function solidRaw(width: number, height: number): RawImage {
  return { data: Buffer.alloc(width * height * 3, 180), width, height, channels: 3 };
}

export interface MediaTestApp extends TestApp {
  heic: FakeHeicDecoder;
  publicDir: string;
  privateDir: string;
}

export async function createMediaTestApp(): Promise<MediaTestApp> {
  const heic = new FakeHeicDecoder();
  const publicDir = path.resolve(requiredEnv('UPLOAD_DIR'));
  const privateDir = path.resolve(requiredEnv('PRIVATE_UPLOAD_DIR'));
  await Promise.all([
    rm(publicDir, { recursive: true, force: true }),
    rm(privateDir, { recursive: true, force: true }),
  ]);
  const t = await createTestApp({
    override: (b) => b.overrideProvider(HEIC_DECODER).useValue(heic),
  });
  return { ...t, heic, publicDir, privateDir };
}

function requiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
}

/** Multipart upload request with a session (cookie + CSRF + Origin). */
export function upload(
  t: TestApp,
  session: TestSession | null,
  opts: {
    /** A MediaPurpose, or any string to exercise validation. */
    purpose?: string;
    file?: Buffer;
    filename?: string;
    contentType?: string;
    admin?: boolean;
    field?: string;
  },
): Test {
  const base = opts.admin ? '/api/v1/admin/media' : '/api/v1/media';
  const url = opts.purpose === undefined ? base : `${base}?purpose=${opts.purpose}`;
  let req = t.http().post(url);
  if (session) req = withSession(req, session);
  if (opts.file) {
    req = req.attach(opts.field ?? 'file', opts.file, {
      filename: opts.filename ?? 'photo.jpg',
      contentType: opts.contentType ?? 'image/jpeg',
    });
  }
  return req;
}

/**
 * Image upload as the API answers it (202 PENDING: images are only decoded by the worker), then
 * the worker's processing step run directly. Resolves to the READY row as the uploader sees it.
 */
export async function uploadReady(
  t: TestApp,
  session: TestSession,
  opts: Parameters<typeof upload>[2],
): Promise<OwnMediaView> {
  const res = await upload(t, session, opts).expect(202);
  const id = (res.body as OwnMediaView).id;
  await expect(t.app.get(MediaProcessingService).processPending(id)).resolves.toBe('READY');
  const path = opts.admin ? `/api/v1/admin/media/${id}` : `/api/v1/media/${id}`;
  const view = await withSession(t.http().get(path), session).expect(200);
  return view.body as OwnMediaView;
}

/** CSRF header without the matching cookie value. */
export function withBadCsrf(req: Test, session: TestSession): Test {
  return req
    .set('Cookie', session.cookie)
    .set(HEADER_NAMES.CSRF, 'not-the-token')
    .set('Origin', session.origin);
}

/** Ids of a paginated response body. */
export function itemIds(body: unknown): string[] {
  return (body as { items: { id: string }[] }).items.map((i) => i.id);
}
