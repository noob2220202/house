import { rm } from 'node:fs/promises';
import path from 'node:path';
import { HEADER_NAMES } from '@house/shared';
import type { Test } from 'supertest';
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
