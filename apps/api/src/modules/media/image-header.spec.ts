import { SniffedMime } from '@house/shared';
import sharp from 'sharp';
import { jpegWithExif, png, pngHeaderOnly, webp } from '../../../test/e2e/media/fixtures';
import { readImageHeader } from './image-header';

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } });

describe('sharp dependency', () => {
  // SEC-01: libvips/libheif/librsvg CVEs fixed in sharp 0.35.5. Guard against a downgrade.
  it('is at least 0.35.5', () => {
    const version = sharp.versions.sharp;
    const [major = 0, minor = 0, patch = 0] = version.split('.').map((p) => parseInt(p, 10));
    expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThanOrEqual(35_005);
  });
});

describe('readImageHeader (pure TS, no libvips)', () => {
  it('JPEG: frame size from SOF (EXIF orientation does not change the pixel count)', async () => {
    expect(readImageHeader(await jpegWithExif(400, 200), SniffedMime.JPEG)).toEqual({
      width: 400,
      height: 200,
    });
    const progressive = await solid(33, 17).jpeg({ progressive: true }).toBuffer();
    expect(readImageHeader(progressive, SniffedMime.JPEG)).toEqual({ width: 33, height: 17 });
  });

  it('PNG: IHDR, including huge header-only images (no allocation)', async () => {
    expect(readImageHeader(await png(64, 48), SniffedMime.PNG)).toEqual({ width: 64, height: 48 });
    expect(readImageHeader(pngHeaderOnly(20_000, 20_000), SniffedMime.PNG)).toEqual({
      width: 20_000,
      height: 20_000,
    });
  });

  it('WebP: lossy (VP8), lossless (VP8L) and extended (VP8X)', async () => {
    expect(readImageHeader(await webp(64, 48), SniffedMime.WEBP)).toEqual({
      width: 64,
      height: 48,
    });
    const lossless = await solid(1000, 3).webp({ lossless: true }).toBuffer();
    expect(lossless.toString('latin1', 12, 16)).toBe('VP8L');
    expect(readImageHeader(lossless, SniffedMime.WEBP)).toEqual({ width: 1000, height: 3 });
    const extended = await solid(70, 30).webp({ quality: 50, alphaQuality: 50 }).toBuffer();
    expect(extended.toString('latin1', 12, 16)).toBe('VP8X');
    expect(readImageHeader(extended, SniffedMime.WEBP)).toEqual({ width: 70, height: 30 });
  });

  it('returns null for truncated or malformed headers instead of throwing', async () => {
    const jpeg = await jpegWithExif(40, 20);
    const cases: [Buffer, string][] = [
      [Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), SniffedMime.JPEG], // segment length 0
      [Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2]), SniffedMime.JPEG], // scan before frame
      [Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2]), SniffedMime.JPEG], // overruns
      [jpeg.subarray(0, 30), SniffedMime.JPEG],
      [(await png()).subarray(0, 20), SniffedMime.PNG],
      [(await webp()).subarray(0, 24), SniffedMime.WEBP],
      [Buffer.from('RIFF\0\0\0\0WEBPVP9 ' + '\0'.repeat(20), 'latin1'), SniffedMime.WEBP],
      [jpeg, SniffedMime.HEIC],
    ];
    for (const [data, mime] of cases) expect(readImageHeader(data, mime)).toBeNull();
  });

  it('never throws on random bytes behind a valid signature', () => {
    const prefixes: [number[], string][] = [
      [[0xff, 0xd8], SniffedMime.JPEG],
      [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], SniffedMime.PNG],
      [[...Buffer.from('RIFF\0\0\0\0WEBPVP8X', 'latin1')], SniffedMime.WEBP],
    ];
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff;
    for (const [prefix, mime] of prefixes) {
      for (let n = 0; n < 500; n++) {
        const body = Buffer.from(Array.from({ length: n % 64 }, rnd));
        expect(() =>
          readImageHeader(Buffer.concat([Buffer.from(prefix), body]), mime),
        ).not.toThrow();
      }
    }
  });
});
