import { crc32, deflateSync } from 'node:zlib';
import sharp from 'sharp';

/** In-memory test images, shared by the media unit specs and e2e suites. */
export async function jpegWithExif(width = 400, height = 200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#c03030' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestCam', Model: 'GPS-Leaker' }, IFD3: { GPSLatitudeRef: 'N' } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

export function png(width = 64, height = 48, alpha = true): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 0, g: 120, b: 200, alpha: 0.5 } : '#0078c8',
    },
  })
    .png()
    .toBuffer();
}

export function webp(width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#30a030' } })
    .webp()
    .toBuffer();
}

/**
 * A PNG whose header claims `width`×`height` but carries a single tiny IDAT: enough for header-only
 * probes (decompression-bomb checks) without allocating the pixels.
 */
export function pngHeaderOnly(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.alloc(16))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Minimal ISO-BMFF header with HEIC brands (content is fake; decode via a fake HeicDecoder). */
export function fakeHeic(): Buffer {
  const ftyp = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('ftypheic', 'latin1'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('mif1heic', 'latin1'),
  ]);
  return Buffer.concat([ftyp, Buffer.alloc(256, 7)]);
}

export function pdf(complete = true): Buffer {
  const body = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n';
  return Buffer.from(complete ? `${body}%%EOF\n` : body, 'latin1');
}
