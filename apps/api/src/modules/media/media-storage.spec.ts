import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AppConfig } from '../../config/app-config.service';
import { assertDisjointRoots, MediaStorage } from './media-storage';

describe('MediaStorage', () => {
  let dir: string;
  let storage: MediaStorage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'media-storage-'));
    const env: Record<string, string> = {
      UPLOAD_DIR: path.join(dir, 'public'),
      PRIVATE_UPLOAD_DIR: path.join(dir, 'private'),
      MEDIA_BASE_URL: '/media/',
    };
    storage = new MediaStorage({ get: (k: string) => env[k] } as unknown as AppConfig);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('generates random, sharded keys and variant keys', () => {
    const now = new Date('2026-03-05T00:00:00Z');
    const a = storage.newPublicImageKey(now);
    const b = storage.newPublicImageKey(now);
    expect(a).toMatch(/^img\/2026\/03\/([0-9a-f]{2})\/\1[0-9a-f]{30}\.webp$/);
    expect(a).not.toBe(b);
    expect(storage.variantKey(a, 'thumb')).toBe(a.replace('.webp', '_thumb.webp'));
    expect(storage.newPrivateKey('pdf', now)).toMatch(/^doc\/2026\/03\/[0-9a-f]{32}\.pdf$/);
    expect(() => storage.newPrivateKey('../x')).toThrow();
    expect(storage.publicUrl('img/a.webp')).toBe('/media/img/a.webp');
  });

  it('refuses keys that escape the root', () => {
    expect(storage.resolve('PUBLIC', '../etc/passwd')).toBeNull();
    expect(storage.resolve('PUBLIC', '/etc/passwd')).toBeNull();
    expect(storage.resolve('PUBLIC', 'img/../../x')).toBeNull();
    expect(storage.resolve('PRIVATE', 'doc/2026/01/a.pdf')).toBe(
      path.join(dir, 'private', 'doc/2026/01/a.pdf'),
    );
    expect(() => storage.stagingKey('../../x')).toThrow();
  });

  it('writes atomically with restrictive modes and removes idempotently', async () => {
    const key = 'doc/2026/01/abc.pdf';
    await storage.write('PRIVATE', key, Buffer.from('secret'));
    const file = path.join(dir, 'private', key);
    expect(await readFile(file, 'utf8')).toBe('secret');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await storage.size('PRIVATE', key)).toBe(6);
    await storage.remove('PRIVATE', [key, 'doc/missing.pdf']);
    expect(await storage.size('PRIVATE', key)).toBeNull();

    await storage.write('PUBLIC', 'img/x.webp', Buffer.from('img'));
    expect((await stat(path.join(dir, 'public', 'img/x.webp'))).mode & 0o777).toBe(0o644);
  });

  it('keeps raw uploads in private staging', async () => {
    const id = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    await storage.writeStaging(id, Buffer.from('raw'));
    expect((await storage.readStaging(id))?.toString()).toBe('raw');
    expect(await stat(path.join(dir, 'private', 'staging', id))).toBeTruthy();
    await storage.removeStaging(id);
    expect(await storage.readStaging(id)).toBeNull();
  });

  it('refuses to start when the public and private roots overlap', () => {
    const make = (pub: string, priv: string) => () =>
      new MediaStorage({
        get: (k: string) =>
          ({ UPLOAD_DIR: pub, PRIVATE_UPLOAD_DIR: priv, MEDIA_BASE_URL: '/media' })[k],
      } as unknown as AppConfig);
    expect(make('/var/lib/house/uploads', '/var/lib/house/uploads/private')).toThrow(/must not/);
    expect(make('/var/lib/house/private/pub', '/var/lib/house/private')).toThrow(/must not/);
    expect(make('/var/lib/house/uploads', '/var/lib/house/uploads/')).toThrow(/must not/);
    expect(() => assertDisjointRoots('/srv/a/../b', '/srv/b/docs')).toThrow(/must not/);
    // Sibling directories sharing a name prefix are fine.
    expect(() =>
      assertDisjointRoots('/var/lib/house/uploads', '/var/lib/house/uploads-private'),
    ).not.toThrow();
  });
});
