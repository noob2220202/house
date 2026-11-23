import { MediaPurpose, MediaVisibility } from '../enums/media';
import { UserRole } from '../enums/user';
import {
  canAdminUpload,
  canUserUpload,
  isAcceptedMime,
  MEDIA_PURPOSE_RULES,
  mediaMaxBytes,
  mediaVisibilityFor,
} from './rules';
import { adminMediaListQuerySchema, myMediaListQuerySchema } from './schemas';
import { isHeifMime, sniffMime, SniffedMime } from './sniff';

const bytes = (...parts: (number[] | string)[]): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );

function ftyp(major: string, compatible: string[] = []): Uint8Array {
  const size = 16 + compatible.length * 4;
  return bytes([0, 0, 0, size], 'ftyp', major, [0, 0, 0, 0], ...compatible, [0, 0, 0, 0]);
}

describe('sniffMime', () => {
  it('detects supported signatures', () => {
    expect(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe(SniffedMime.JPEG);
    expect(sniffMime(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      SniffedMime.PNG,
    );
    expect(sniffMime(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))).toBe(SniffedMime.WEBP);
    expect(sniffMime(bytes('%PDF-1.7\n'))).toBe(SniffedMime.PDF);
    expect(sniffMime(ftyp('heic', ['mif1', 'heic']))).toBe(SniffedMime.HEIC);
    expect(sniffMime(ftyp('mif1', ['heic']))).toBe(SniffedMime.HEIC);
    expect(sniffMime(ftyp('mif1', ['miaf']))).toBe(SniffedMime.HEIF);
  });

  it('rejects everything else, whatever the extension says', () => {
    expect(sniffMime(bytes('GIF89a'))).toBeNull();
    expect(sniffMime(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffMime(bytes('<!DOCTYPE html>'))).toBeNull();
    expect(sniffMime(bytes([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip
    expect(sniffMime(bytes('RIFF', [0, 0, 0, 0], 'WAVE'))).toBeNull();
    expect(sniffMime(ftyp('avif', ['mif1', 'avif']))).toBeNull();
    expect(sniffMime(ftyp('isom', ['mp41']))).toBeNull(); // mp4
    expect(sniffMime(new Uint8Array())).toBeNull();
    expect(sniffMime(bytes([0xff, 0xd8]))).toBeNull();
  });

  it('isHeifMime', () => {
    expect(isHeifMime('image/heic')).toBe(true);
    expect(isHeifMime('image/heif')).toBe(true);
    expect(isHeifMime('image/jpeg')).toBe(false);
  });
});

describe('media purpose rules', () => {
  it('every purpose has a rule; documents are private', () => {
    for (const p of Object.values(MediaPurpose)) expect(MEDIA_PURPOSE_RULES[p]).toBeDefined();
    expect(mediaVisibilityFor(MediaPurpose.AGENCY_DOCUMENT)).toBe(MediaVisibility.PRIVATE);
    expect(mediaVisibilityFor(MediaPurpose.LISTING_PHOTO)).toBe(MediaVisibility.PUBLIC);
  });

  it('who may upload what', () => {
    expect(canUserUpload(MediaPurpose.LISTING_PHOTO, UserRole.USER)).toBe(false);
    expect(canUserUpload(MediaPurpose.LISTING_PHOTO, UserRole.AGENT)).toBe(true);
    expect(canUserUpload(MediaPurpose.LISTING_PHOTO, UserRole.AGENCY_OWNER)).toBe(true);
    expect(canUserUpload(MediaPurpose.AGENCY_DOCUMENT, UserRole.USER)).toBe(true);
    expect(canUserUpload(MediaPurpose.BANNER, UserRole.AGENCY_OWNER)).toBe(false);
    expect(canAdminUpload(MediaPurpose.BANNER)).toBe(true);
    expect(canAdminUpload(MediaPurpose.COMPLEX_PHOTO)).toBe(true);
    expect(canAdminUpload(MediaPurpose.DEAL_REQUEST_PHOTO)).toBe(false);
  });

  it('accepted types and byte limits', () => {
    expect(isAcceptedMime(MediaPurpose.LISTING_PHOTO, 'image/heic')).toBe(true);
    expect(isAcceptedMime(MediaPurpose.LISTING_PHOTO, 'application/pdf')).toBe(false);
    expect(isAcceptedMime(MediaPurpose.AGENCY_DOCUMENT, 'application/pdf')).toBe(true);
    expect(isAcceptedMime(MediaPurpose.AGENCY_DOCUMENT, 'image/webp')).toBe(false);
    expect(mediaMaxBytes(MediaPurpose.AGENCY_DOCUMENT, 100 * 1024 * 1024)).toBe(10 * 1024 * 1024);
    expect(mediaMaxBytes(MediaPurpose.LISTING_PHOTO, 1024)).toBe(1024);
  });
});

describe('media list query schemas', () => {
  it('parses csv filters and pagination', () => {
    expect(myMediaListQuerySchema.parse({ purpose: 'LISTING_PHOTO,PROFILE', page: '2' })).toEqual(
      expect.objectContaining({ purpose: ['LISTING_PHOTO', 'PROFILE'], page: 2 }),
    );
    expect(adminMediaListQuerySchema.parse({ orphaned: 'true' }).orphaned).toBe(true);
    expect(myMediaListQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(adminMediaListQuerySchema.safeParse({ ownerUserId: 'x' }).success).toBe(false);
  });
});
