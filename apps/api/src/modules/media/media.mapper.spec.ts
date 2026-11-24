import type { AppConfig } from '../../config/app-config.service';
import { MediaStorage } from './media-storage';
import { MediaMapper, parseVariants } from './media.mapper';
import type { MediaViewRow } from './media.selects';
import { sanitizeFilename } from './media-upload.service';

const env: Record<string, string> = {
  UPLOAD_DIR: '/tmp/u',
  PRIVATE_UPLOAD_DIR: '/tmp/p',
  MEDIA_BASE_URL: 'https://cdn.example.test/media',
};
const mapper = new MediaMapper(
  new MediaStorage({ get: (k: string) => env[k] } as unknown as AppConfig),
);

const counts = {
  listingPhotos: 0,
  complexPhotos: 0,
  dealRequestPhotos: 0,
  agencyDocuments: 0,
  agencyLogos: 0,
  agencyCovers: 0,
  bannersPc: 0,
  bannersMobile: 0,
  popups: 0,
};

function row(overrides: Partial<MediaViewRow> = {}): MediaViewRow {
  return {
    id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
    purpose: 'LISTING_PHOTO',
    visibility: 'PUBLIC',
    status: 'READY',
    mimeType: 'image/webp',
    sizeBytes: 1234,
    width: 800,
    height: 600,
    storageKey: 'img/2026/01/ab/abc.webp',
    variants: {
      thumb: { key: 'img/2026/01/ab/abc_thumb.webp', width: 320, height: 240 },
      medium: { key: 'img/2026/01/ab/abc_medium.webp', width: 800, height: 600 },
      bogus: { key: 'x' },
    },
    originalFilename: '거실.jpg',
    error: null,
    ownerUserId: 'u1',
    ownerAdminId: null,
    sha256: 'f'.repeat(64),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    _count: { ...counts },
    ...overrides,
  };
}

describe('MediaMapper', () => {
  it('builds public URLs and falls back to the full-size image', () => {
    const view = mapper.toView(row());
    expect(view.url).toBe('https://cdn.example.test/media/img/2026/01/ab/abc.webp');
    expect(view.variants.thumb).toEqual({
      url: 'https://cdn.example.test/media/img/2026/01/ab/abc_thumb.webp',
      width: 320,
      height: 240,
    });
    expect(view.variants.large).toBeUndefined();
    expect(mapper.variantUrls(row()).large).toBe(view.url);
    expect(view).not.toHaveProperty('storageKey');
    expect(view).not.toHaveProperty('originalFilename');
    expect(view).not.toHaveProperty('sha256');
  });

  it('never exposes URLs for private or unprocessed files', () => {
    for (const r of [row({ visibility: 'PRIVATE' }), row({ status: 'PENDING' })]) {
      const v = mapper.toView(r);
      expect(v.url).toBeNull();
      expect(v.variants).toEqual({});
    }
  });

  it('own/admin views add file name, attachment state and references', () => {
    const attached = row({ _count: { ...counts, listingPhotos: 2 } });
    expect(mapper.toOwnView(row())).toMatchObject({
      originalFilename: '거실.jpg',
      attached: false,
    });
    expect(mapper.toOwnView(attached).attached).toBe(true);
    expect(mapper.toAdminView(attached)).toMatchObject({
      sha256: 'f'.repeat(64),
      references: { listingPhotos: 2 },
      deletedAt: null,
    });
  });

  it('parseVariants ignores malformed JSON', () => {
    expect(parseVariants(null)).toEqual({});
    expect(parseVariants([])).toEqual({});
    expect(parseVariants({ thumb: { key: '', width: 1, height: 1 } })).toEqual({});
  });
});

describe('sanitizeFilename', () => {
  it('keeps a display-safe base name', () => {
    expect(sanitizeFilename('C:\\Users\\me\\사진 1.jpg')).toBe('사진 1.jpg');
    expect(sanitizeFilename('../../etc/"pass"\u0000wd<x>')).toBe('passwdx');
    expect(sanitizeFilename('')).toBeNull();
    expect(sanitizeFilename(undefined)).toBeNull();
    expect(sanitizeFilename('a'.repeat(300))?.length).toBe(255);
  });
});
