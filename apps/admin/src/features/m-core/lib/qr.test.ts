import { describe, expect, it } from 'vitest';
import {
  addEccAndInterleave,
  alignmentPositions,
  buildDataCodewords,
  dataCodewords,
  encodeQrCode,
  formatBits,
  gfMul,
  maskAt,
  pickVersion,
  qrPath,
  rsRemainder,
  versionBits,
  type QrMatrix,
} from './qr';

// ---- an independent reader used to round-trip the encoder output --------------------------------

function isFunctionModule(ver: number, x: number, y: number): boolean {
  const size = ver * 4 + 17;
  if (x === 6 || y === 6) return true; // timing
  if (x <= 8 && y <= 8) return true; // top-left finder + format
  if (x >= size - 8 && y <= 8) return true; // top-right finder + format
  if (x <= 8 && y >= size - 8) return true; // bottom-left finder + format + dark module
  if (ver >= 7 && ((x >= size - 11 && y <= 5) || (y >= size - 11 && x <= 5))) return true;
  const align = alignmentPositions(ver);
  const last = align.length - 1;
  for (let i = 0; i <= last; i += 1) {
    for (let j = 0; j <= last; j += 1) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      if (Math.abs(x - align[j]!) <= 2 && Math.abs(y - align[i]!) <= 2) return true;
    }
  }
  return false;
}

function readFormat(m: QrMatrix): number {
  // First copy, around the top-left finder: bits 0..14.
  const at = (x: number, y: number) => (m[y]![x] ? 1 : 0);
  const coords: [number, number][] = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  return coords.reduce((acc, [x, y], i) => acc | (at(x, y) << i), 0);
}

function syndromesAreZero(block: readonly number[], eccLen: number): boolean {
  // Evaluate the codeword polynomial at α^0 … α^(eccLen-1); all must be 0 for a valid RS codeword.
  let root = 1;
  for (let i = 0; i < eccLen; i += 1) {
    let acc = 0;
    for (const c of block) acc = gfMul(acc, root) ^ c;
    if (acc !== 0) return false;
    root = gfMul(root, 2);
  }
  return true;
}

function decode(m: QrMatrix): { text: string; mask: number; version: number } {
  const size = m.length;
  const ver = (size - 17) / 4;
  const fmt = readFormat(m) ^ 0x5412;
  const mask = (fmt >>> 10) & 7;
  expect((fmt >>> 13) & 3).toBe(0); // level M
  // Zigzag read, bottom-right upwards, two columns at a time, skipping the timing column.
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let k = 0; k < size; k += 1) {
      const y = upward ? size - 1 - k : k;
      for (const x of [right, right - 1]) {
        if (isFunctionModule(ver, x, y)) continue;
        bits.push((m[y]![x] ? 1 : 0) ^ (maskAt(mask, x, y) ? 1 : 0));
      }
    }
    upward = !upward;
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    codewords.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // De-interleave (level M tables re-derived from the encoder's own capacity helpers).
  const total = codewords.length;
  const dataLen = dataCodewords(ver);
  const eccTotal = total - dataLen;
  // number of blocks: try every divisor consistent with the encoder's interleaving
  let text = '';
  let ok = false;
  for (let numBlocks = 1; numBlocks <= 49 && !ok; numBlocks += 1) {
    if (eccTotal % numBlocks !== 0) continue;
    const eccLen = eccTotal / numBlocks;
    const shortLen = Math.floor(dataLen / numBlocks);
    const numLong = dataLen % numBlocks;
    const numShort = numBlocks - numLong;
    const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
    let p = 0;
    for (let i = 0; i < shortLen + 1; i += 1) {
      for (let b = 0; b < numBlocks; b += 1) {
        if (i === shortLen && b < numShort) continue;
        blocks[b]!.push(codewords[p]!);
        p += 1;
      }
    }
    for (let i = 0; i < eccLen; i += 1) {
      for (let b = 0; b < numBlocks; b += 1) {
        blocks[b]!.push(codewords[p]!);
        p += 1;
      }
    }
    if (!blocks.every((b) => syndromesAreZero(b, eccLen))) continue;
    ok = true;
    const data = blocks.flatMap((b) => b.slice(0, b.length - eccLen));
    const dataBits = data.flatMap((byte) =>
      Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1),
    );
    const take = (from: number, len: number) =>
      dataBits.slice(from, from + len).reduce((a, b) => (a << 1) | b, 0);
    expect(take(0, 4)).toBe(0b0100);
    const countBits = ver <= 9 ? 8 : 16;
    const count = take(4, countBits);
    const bytes = Array.from({ length: count }, (_, i) => take(4 + countBits + i * 8, 8));
    text = new TextDecoder().decode(new Uint8Array(bytes));
  }
  expect(ok).toBe(true);
  return { text, mask, version: ver };
}

// ---- tests ----------------------------------------------------------------------------------------

describe('qr · building blocks', () => {
  it('computes Reed–Solomon EC codewords (published "HELLO WORLD" 1-M vector)', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it('computes format and version information bits', () => {
    expect(formatBits(0)).toBe(0b101010000010010);
    expect(formatBits(1)).toBe(0b101000100100101);
    expect(formatBits(5)).toBe(0b100000011001110);
    expect(formatBits(7)).toBe(0b100101010100000);
    expect(versionBits(7)).toBe(0b000111110010010100);
  });

  it('knows the level-M capacity and alignment centres', () => {
    expect(dataCodewords(1)).toBe(16);
    expect(dataCodewords(5)).toBe(86);
    expect(dataCodewords(10)).toBe(216);
    expect(dataCodewords(40)).toBe(2334);
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
  });

  it('picks the smallest version that fits (byte mode)', () => {
    expect(pickVersion(14)).toBe(1); // 4 + 8 + 112 = 124 ≤ 128
    expect(pickVersion(15)).toBe(2);
    expect(pickVersion(213)).toBe(10);
    expect(pickVersion(214)).toBe(11);
    expect(pickVersion(5000)).toBeNull();
  });

  it('pads data codewords with 0xEC / 0x11', () => {
    const cw = buildDataCodewords([0x41], 1);
    expect(cw).toHaveLength(16);
    expect(cw.slice(0, 3)).toEqual([0x40, 0x14, 0x10]);
    expect(cw.slice(3, 7)).toEqual([0xec, 0x11, 0xec, 0x11]);
  });

  it('interleaves multi-block versions to the full codeword count', () => {
    const data = Array.from({ length: dataCodewords(5) }, (_, i) => i);
    const all = addEccAndInterleave(data, 5); // 2 blocks of 43 data + 24 EC
    expect(all).toHaveLength(134);
    expect(all.slice(0, 4)).toEqual([0, 43, 1, 44]);
  });
});

describe('qr · encodeQrCode', () => {
  it('draws finder patterns, timing and the dark module', () => {
    const { modules, size, version } = encodeQrCode('BRAND');
    expect(version).toBe(1);
    expect(size).toBe(21);
    const finder = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
    const corner = (ox: number, oy: number) =>
      Array.from({ length: 7 }, (_, y) =>
        Array.from({ length: 7 }, (_, x) => (modules[oy + y]![ox + x] ? '1' : '0')).join(''),
      );
    expect(corner(0, 0)).toEqual(finder);
    expect(corner(size - 7, 0)).toEqual(finder);
    expect(corner(0, size - 7)).toEqual(finder);
    for (let i = 8; i < size - 8; i += 1) {
      expect(modules[6]![i]).toBe(i % 2 === 0);
      expect(modules[i]![6]).toBe(i % 2 === 0);
    }
    expect(modules[size - 8]![8]).toBe(true);
  });

  it('writes both copies of the format information', () => {
    const { modules, size, mask } = encodeQrCode('format', { mask: 3 });
    expect(mask).toBe(3);
    const bits = formatBits(3);
    for (let i = 0; i < 8; i += 1) expect(modules[8]![size - 1 - i]).toBe(((bits >>> i) & 1) !== 0);
    for (let i = 8; i < 15; i += 1)
      expect(modules[size - 15 + i]![8]).toBe(((bits >>> i) & 1) !== 0);
    expect(readFormat(modules)).toBe(bits);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])('round-trips with mask %i', (mask) => {
    const text = 'otpauth://totp/BRAND:admin@example.com?secret=JBSWY3DPEHPK3PXP';
    const decoded = decode(encodeQrCode(text, { mask }).modules);
    expect(decoded.mask).toBe(mask);
    expect(decoded.text).toBe(text);
  });

  it('round-trips a realistic otpauth URI (multi-block, alignment patterns)', () => {
    const uri =
      'otpauth://totp/BRAND%20%EA%B4%80%EB%A6%AC%EC%9E%90:operator%40example.com' +
      '?secret=KRSXG5CTMVRXEZLUKN2XAZLSKNSWG4TFOQ&issuer=BRAND%20%EA%B4%80%EB%A6%AC%EC%9E%90' +
      '&algorithm=SHA1&digits=6&period=30';
    const qr = encodeQrCode(uri);
    expect(qr.version).toBeGreaterThanOrEqual(7); // exercises the version-information block
    expect(decode(qr.modules).text).toBe(uri);
  });

  it.each([1, 2, 6, 7, 10, 14, 21])('round-trips at version %i', (minVersion) => {
    const text = `v${minVersion} · 순천 ${'x'.repeat(minVersion)}`;
    const qr = encodeQrCode(text, { minVersion });
    expect(qr.version).toBe(minVersion);
    expect(decode(qr.modules)).toMatchObject({ text, version: minVersion });
  });

  it('rejects text that cannot fit', () => {
    expect(() => encodeQrCode('x'.repeat(3000))).toThrow(RangeError);
  });

  it('renders a compact SVG path', () => {
    const d = qrPath(
      [
        [true, true, false],
        [false, false, true],
      ],
      4,
    );
    expect(d).toBe('M4 4h2v1h-2zM6 5h1v1h-1z');
  });
});
