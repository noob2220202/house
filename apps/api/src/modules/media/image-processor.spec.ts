import { ErrorCode } from '@house/shared';
import sharp from 'sharp';
import {
  fakeHeic,
  jpegWithExif,
  pdf,
  png,
  pngHeaderOnly,
  webp,
} from '../../../test/e2e/media/fixtures';
import { AppException } from '../../common/errors/app.exception';
import { ImageProcessor } from './image-processor';
import type { HeicDecoder, RawImage } from './ports/heic-decoder.port';

class FakeHeic implements HeicDecoder {
  calls = 0;
  constructor(
    private readonly result: RawImage | Error,
    readonly supported = true,
  ) {}
  decode(): Promise<RawImage> {
    this.calls++;
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

const raw = (width: number, height: number): RawImage => ({
  data: Buffer.alloc(width * height * 3, 200),
  width,
  height,
  channels: 3,
});

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return `${err.code}:${err.getStatus()}`;
    throw err;
  }
  throw new Error('expected rejection');
}

describe('ImageProcessor', () => {
  const processor = new ImageProcessor(new FakeHeic(raw(10, 10)));

  it('auto-rotates, strips EXIF/GPS and writes webp variants without enlarging', async () => {
    const input = await jpegWithExif(400, 200); // orientation 6 → portrait 200×400
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processor.processImage(input, 'image/jpeg');

    expect(out.original).toMatchObject({ width: 200, height: 400 });
    expect(out.variants.thumb).toMatchObject({ width: 200, height: 240 }); // cover, no enlarge
    expect(out.variants.medium).toMatchObject({ width: 200, height: 400 });
    expect(out.variants.large).toMatchObject({ width: 200, height: 400 });
    for (const file of [out.original, ...Object.values(out.variants)]) {
      const meta = await sharp(file.data).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(file.data.includes(Buffer.from('GPS-Leaker'))).toBe(false);
    }
  });

  it('downscales large images into the variant boxes', async () => {
    const input = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#888' },
    })
      .jpeg()
      .toBuffer();
    const out = await processor.processImage(input, 'image/jpeg');
    expect(out.original).toMatchObject({ width: 3000, height: 2000 });
    expect(out.variants.thumb).toMatchObject({ width: 320, height: 240 });
    expect(out.variants.medium).toMatchObject({ width: 960, height: 640 });
    expect(out.variants.large).toMatchObject({ width: 1920, height: 1280 });
  });

  it('keeps transparency of PNG / webp input', async () => {
    const out = await processor.processImage(await png(64, 48), 'image/png');
    expect((await sharp(out.original.data).metadata()).hasAlpha).toBe(true);
    const w = await processor.processImage(await webp(30, 20), 'image/webp');
    expect(w.original).toMatchObject({ width: 30, height: 20 });
  });

  it('probe swaps axes for EXIF-rotated input and checks the real format', async () => {
    await expect(processor.probe(await jpegWithExif(400, 200), 'image/jpeg')).resolves.toEqual({
      width: 200,
      height: 400,
    });
    expect(await codeOf(processor.probe(await png(), 'image/jpeg'))).toBe(
      'MEDIA_UNSUPPORTED_TYPE:415',
    );
    expect(await codeOf(processor.probe(Buffer.from([0xff, 0xd8, 0xff, 0, 1]), 'image/jpeg'))).toBe(
      'MEDIA_UNSUPPORTED_TYPE:415',
    );
    await expect(processor.probe(fakeHeic(), 'image/heic')).resolves.toBeNull();
  });

  it('rejects decompression bombs from the header alone', async () => {
    expect(await codeOf(processor.probe(pngHeaderOnly(20_000, 20_000), 'image/png'))).toBe(
      `${ErrorCode.MEDIA_DIMENSIONS_INVALID}:400`,
    );
  });

  it('fails truncated image data as MEDIA_PROCESSING_FAILED', async () => {
    const full = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#123' },
    })
      .png()
      .toBuffer();
    const truncated = full.subarray(0, 120);
    const code = await codeOf(processor.processImage(truncated, 'image/png'));
    expect(['MEDIA_PROCESSING_FAILED:422', 'MEDIA_UNSUPPORTED_TYPE:415']).toContain(code);
  });

  it('converts HEIC through the decoder port', async () => {
    const heic = new FakeHeic(raw(40, 30));
    const out = await new ImageProcessor(heic).processImage(fakeHeic(), 'image/heic');
    expect(heic.calls).toBe(1);
    expect(out.original).toMatchObject({ width: 40, height: 30 });
    expect((await sharp(out.variants.thumb.data).metadata()).format).toBe('webp');
  });

  it('propagates HEIC decoder rejections and bomb checks', async () => {
    const failing = new ImageProcessor(
      new FakeHeic(new AppException(ErrorCode.MEDIA_HEIC_UNSUPPORTED, { status: 415 })),
    );
    expect(await codeOf(failing.processImage(fakeHeic(), 'image/heic'))).toBe(
      'MEDIA_HEIC_UNSUPPORTED:415',
    );
    const huge = new ImageProcessor(
      new FakeHeic({ data: Buffer.alloc(3), width: 20_000, height: 20_000, channels: 3 }),
    );
    expect(await codeOf(huge.processImage(fakeHeic(), 'image/heic'))).toBe(
      'MEDIA_DIMENSIONS_INVALID:400',
    );
  });

  it('assertDecodable refuses HEIC up front when the decoder cannot handle it', () => {
    const unsupported = new ImageProcessor(new FakeHeic(raw(1, 1), false));
    expect(() => unsupported.assertDecodable('image/heic')).toThrow(AppException);
    expect(() => unsupported.assertDecodable('image/jpeg')).not.toThrow();
    expect(() => processor.assertDecodable('image/heif')).not.toThrow();
  });

  describe('documents', () => {
    it('stores complete PDFs as uploaded and rejects truncated ones', async () => {
      const file = pdf();
      await expect(processor.processDocument(file, 'application/pdf')).resolves.toMatchObject({
        data: file,
        mimeType: 'application/pdf',
        ext: 'pdf',
      });
      expect(await codeOf(processor.processDocument(pdf(false), 'application/pdf'))).toBe(
        'MEDIA_PROCESSING_FAILED:422',
      );
    });

    it('re-encodes image documents without metadata, keeping JPEG/PNG', async () => {
      const jpeg = await processor.processDocument(await jpegWithExif(), 'image/jpeg');
      expect(jpeg).toMatchObject({ mimeType: 'image/jpeg', ext: 'jpg', width: 200, height: 400 });
      expect((await sharp(jpeg.data).metadata()).exif).toBeUndefined();
      const p = await processor.processDocument(await png(), 'image/png');
      expect(p).toMatchObject({ mimeType: 'image/png', ext: 'png' });
      const heic = await processor.processDocument(fakeHeic(), 'image/heic');
      expect(heic).toMatchObject({ mimeType: 'image/jpeg', ext: 'jpg', width: 10, height: 10 });
    });
  });
});
