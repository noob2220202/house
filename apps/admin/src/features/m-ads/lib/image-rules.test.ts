import { describe, expect, it } from 'vitest';
import {
  AD_IMAGE_MAX_BYTES,
  formatBytes,
  formatSize,
  ratioMatches,
  validateAdImage,
  type ImageMeta,
} from './image-rules';

const HERO = { width: 1920, height: 520 };
const meta = (patch: Partial<ImageMeta> = {}): ImageMeta => ({
  width: 1920,
  height: 520,
  bytes: 640 * 1024,
  type: 'image/jpeg',
  ...patch,
});

describe('validateAdImage', () => {
  it('accepts the exact spec and same-ratio 2× uploads', () => {
    expect(validateAdImage(meta(), HERO)).toEqual({ ok: true, note: '비율 일치' });
    expect(validateAdImage(meta({ width: 3840, height: 1040 }), HERO).ok).toBe(true);
    expect(validateAdImage(meta({ type: 'image/webp' }), HERO).ok).toBe(true);
    expect(validateAdImage(meta({ type: 'image/png' }), HERO).ok).toBe(true);
  });

  it('rejects other file types first', () => {
    for (const type of ['image/gif', 'image/svg+xml', 'image/heic', 'application/pdf', '']) {
      const check = validateAdImage(meta({ type }), HERO);
      expect(check).toMatchObject({ ok: false, code: 'TYPE' });
    }
  });

  it('rejects files over the size cap', () => {
    const check = validateAdImage(meta({ bytes: AD_IMAGE_MAX_BYTES + 1 }), HERO);
    expect(check).toMatchObject({ ok: false, code: 'TOO_LARGE' });
    expect(validateAdImage(meta({ bytes: AD_IMAGE_MAX_BYTES }), HERO).ok).toBe(true);
  });

  it('rejects images smaller than the spec before looking at the ratio', () => {
    const check = validateAdImage(meta({ width: 960, height: 260 }), HERO);
    expect(check).toMatchObject({ ok: false, code: 'TOO_SMALL' });
    if (!check.ok) expect(check.message).toContain('960 × 260');
  });

  it('rejects a different aspect ratio', () => {
    expect(validateAdImage(meta({ width: 1920, height: 1080 }), HERO)).toMatchObject({
      ok: false,
      code: 'RATIO',
    });
  });

  it('tolerates rounding in the ratio (2%)', () => {
    expect(validateAdImage(meta({ width: 1920, height: 526 }), HERO).ok).toBe(true);
    expect(validateAdImage(meta({ width: 1920, height: 540 }), HERO).ok).toBe(false);
  });
});

describe('ratioMatches', () => {
  it('guards against empty sizes', () => {
    expect(ratioMatches({ width: 0, height: 0 }, HERO)).toBe(false);
    expect(ratioMatches({ width: 760, height: 600 }, { width: 380, height: 300 })).toBe(true);
  });
});

describe('formatters', () => {
  it('formats bytes like the design ("640KB", "2MB")', () => {
    expect(formatBytes(640 * 1024)).toBe('640KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2MB');
    expect(formatBytes(1.56 * 1024 * 1024)).toBe('1.6MB');
    expect(formatBytes(12 * 1024 * 1024)).toBe('12MB');
    expect(formatBytes(10)).toBe('1KB');
  });

  it('formats sizes', () => {
    expect(formatSize(HERO)).toBe('1920 × 520');
    expect(formatSize(HERO, '×')).toBe('1920×520');
  });
});
