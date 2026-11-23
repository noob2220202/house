import { SniffedMime } from '@house/shared';

export interface HeaderDimensions {
  width: number;
  height: number;
}

/**
 * Pure-TypeScript header reader for JPEG / PNG / WebP: width × height from the container header,
 * without libvips. The HTTP API uses it to reject malformed or oversized images up front while all
 * actual decoding (sharp) happens in the worker process, so a libvips memory-safety bug triggered
 * by an upload cannot take down the process holding sessions, the DB pool and the secrets.
 * Returns null when the header is truncated or malformed. Pixel count does not depend on EXIF
 * orientation, so orientation is not read here.
 */
export function readImageHeader(data: Buffer, mime: string): HeaderDimensions | null {
  switch (mime) {
    case SniffedMime.JPEG:
      return readJpeg(data);
    case SniffedMime.PNG:
      return readPng(data);
    case SniffedMime.WEBP:
      return readWebp(data);
    default:
      return null;
  }
}

const valid = (width: number, height: number): HeaderDimensions | null =>
  width > 0 && height > 0 ? { width, height } : null;

/** SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC). */
function isSof(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readJpeg(d: Buffer): HeaderDimensions | null {
  if (d.length < 4 || d[0] !== 0xff || d[1] !== 0xd8) return null;
  let i = 2;
  while (i < d.length) {
    if (d[i] !== 0xff) return null;
    while (i < d.length && d[i] === 0xff) i++; // fill bytes
    if (i >= d.length) return null;
    const marker = d[i++] as number;
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    // End of image or start of scan before any frame header: not a usable JPEG.
    if (marker === 0xd9 || marker === 0xda || i + 2 > d.length) return null;
    const len = d.readUInt16BE(i);
    if (len < 2 || i + len > d.length) return null;
    if (isSof(marker)) {
      if (len < 8) return null;
      return valid(d.readUInt16BE(i + 5), d.readUInt16BE(i + 3));
    }
    i += len;
  }
  return null;
}

function readPng(d: Buffer): HeaderDimensions | null {
  // signature(8) + IHDR length(4) + "IHDR"(4) + width(4) + height(4)
  if (d.length < 24 || d.readUInt32BE(8) !== 13 || d.toString('latin1', 12, 16) !== 'IHDR') {
    return null;
  }
  return valid(d.readUInt32BE(16), d.readUInt32BE(20));
}

function readWebp(d: Buffer): HeaderDimensions | null {
  if (d.length < 30 || d.toString('latin1', 0, 4) !== 'RIFF') return null;
  if (d.toString('latin1', 8, 12) !== 'WEBP') return null;
  switch (d.toString('latin1', 12, 16)) {
    case 'VP8 ': {
      // frame tag(3) + start code 9d 01 2a + 14-bit width/height (top 2 bits: scale)
      if (d[23] !== 0x9d || d[24] !== 0x01 || d[25] !== 0x2a) return null;
      return valid(d.readUInt16LE(26) & 0x3fff, d.readUInt16LE(28) & 0x3fff);
    }
    case 'VP8L': {
      if (d[20] !== 0x2f) return null;
      const bits = d.readUInt32LE(21);
      return valid((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    case 'VP8X':
      // flags(4) + canvas width-1 (24-bit LE) + canvas height-1 (24-bit LE)
      return valid(d.readUIntLE(24, 3) + 1, d.readUIntLE(27, 3) + 1);
    default:
      return null;
  }
}
