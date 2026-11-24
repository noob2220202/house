import { describe, expect, it } from 'vitest';
import { documentKind, layoutDocument } from './viewer';

describe('documentKind', () => {
  it('previews only allow-listed raster images and PDFs', () => {
    expect(documentKind('image/jpeg')).toBe('image');
    expect(documentKind('IMAGE/PNG')).toBe('image');
    expect(documentKind('application/pdf')).toBe('pdf');
    expect(documentKind('application/pdf; charset=binary')).toBe('pdf');
  });

  it('never previews script-capable or unknown types', () => {
    for (const type of [
      'text/html',
      'application/xhtml+xml',
      'text/xml',
      'image/svg+xml',
      'application/octet-stream',
      '',
    ])
      expect(documentKind(type)).toBe('other');
  });

  it('accepts SVG only when explicitly allowed (mock stand-ins)', () => {
    expect(documentKind('image/svg+xml', { allowSvg: true })).toBe('image');
    expect(documentKind('text/html', { allowSvg: true })).toBe('other');
  });
});

const A4 = { w: 1000, h: 1414 };

describe('layoutDocument', () => {
  it('fits a portrait page to a wide stage by height', () => {
    const layout = layoutDocument(A4, { w: 672, h: 558 }, 1, 0);
    expect(layout?.frame.h).toBe(Math.round(558 * 0.94));
    expect(layout?.frame.w).toBeLessThan(672);
    expect(layout?.image).toEqual(layout?.frame);
  });
  it('fits a portrait page to a narrow (phone) stage by width', () => {
    const layout = layoutDocument(A4, { w: 310, h: 558 }, 1, 0);
    expect(layout?.frame.w).toBe(Math.round(310 * 0.94));
    expect(layout?.frame.h).toBeLessThanOrEqual(558);
  });
  it('scales with the zoom step', () => {
    const base = layoutDocument(A4, { w: 672, h: 558 }, 1, 0);
    const zoomed = layoutDocument(A4, { w: 672, h: 558 }, 2, 0);
    expect(zoomed?.frame.h).toBeCloseTo((base?.frame.h ?? 0) * 2, -1);
    expect(zoomed?.frame.w).toBeGreaterThan(672 * 0.94);
  });
  it('swaps the bounding box on a quarter turn and keeps the image aspect', () => {
    const stage = { w: 672, h: 558 };
    const turned = layoutDocument(A4, stage, 1, 90);
    // The rotated page is landscape: it now fits by width.
    expect(turned?.frame.w).toBe(Math.round(672 * 0.94));
    expect(turned?.frame.w).toBe(turned?.image.h);
    expect(turned?.frame.h).toBe(turned?.image.w);
    expect(layoutDocument(A4, stage, 1, 270)?.frame).toEqual(turned?.frame);
    expect(layoutDocument(A4, stage, 1, 180)).toEqual(layoutDocument(A4, stage, 1, 0));
  });
  it('returns null until both sizes are known', () => {
    expect(layoutDocument({ w: 0, h: 0 }, { w: 600, h: 500 }, 1, 0)).toBeNull();
    expect(layoutDocument(A4, { w: 0, h: 500 }, 1, 0)).toBeNull();
  });
});
