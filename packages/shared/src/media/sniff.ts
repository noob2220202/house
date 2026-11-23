/**
 * Magic-byte MIME sniffing. The client-sent Content-Type and file extension are never trusted;
 * only these signatures decide what a file is. Works on `Uint8Array` (Node Buffer is one), so
 * frontends can pre-check a File before uploading.
 */
export const SniffedMime = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  HEIC: 'image/heic',
  HEIF: 'image/heif',
  PDF: 'application/pdf',
} as const;
export type SniffedMime = (typeof SniffedMime)[keyof typeof SniffedMime];

/** Bytes needed to sniff every supported type (ISO-BMFF brand lists can run long). */
export const SNIFF_HEADER_BYTES = 64;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// HEVC-coded HEIF ("HEIC") brands, and the generic HEIF image brands.
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);
const HEIF_BRANDS = new Set(['mif1', 'msf1']);
// AV1-coded HEIF is a different format (AVIF) and is not accepted.
const AVIF_BRANDS = new Set(['avif', 'avis']);

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let s = '';
  for (let i = start; i < end && i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return s;
}

function sniffIsoBmff(bytes: Uint8Array): SniffedMime | null {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== 'ftyp') return null;
  const boxSize =
    (((bytes[0] ?? 0) << 24) |
      ((bytes[1] ?? 0) << 16) |
      ((bytes[2] ?? 0) << 8) |
      (bytes[3] ?? 0)) >>>
    0;
  // ftyp box: size(4) 'ftyp'(4) major(4) minor(4) compatible(4*n)
  const end = Math.min(bytes.length, boxSize >= 16 ? boxSize : 16);
  const brands = [ascii(bytes, 8, 12)];
  for (let i = 16; i + 4 <= end; i += 4) brands.push(ascii(bytes, i, i + 4));
  if (brands.some((b) => AVIF_BRANDS.has(b))) return null;
  if (brands.some((b) => HEIC_BRANDS.has(b))) return SniffedMime.HEIC;
  if (brands.some((b) => HEIF_BRANDS.has(b))) return SniffedMime.HEIF;
  return null;
}

/** Detects the real type of a file from its first bytes; null when it is not a supported type. */
export function sniffMime(bytes: Uint8Array): SniffedMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return SniffedMime.JPEG;
  if (startsWith(bytes, PNG_SIGNATURE)) return SniffedMime.PNG;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return SniffedMime.WEBP;
  if (ascii(bytes, 0, 5) === '%PDF-') return SniffedMime.PDF;
  return sniffIsoBmff(bytes);
}

export function isHeifMime(mime: string): boolean {
  return mime === SniffedMime.HEIC || mime === SniffedMime.HEIF;
}
