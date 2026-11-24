/**
 * Minimal QR Code encoder (ISO/IEC 18004, model 2) — byte mode, error-correction level M, versions
 * 1–40, automatic mask selection. Dependency-free on purpose: it only renders the admin TOTP
 * enrolment `otpauth://` URI, so the secret never leaves the page (no QR image service).
 *
 * `encodeQr(text)` returns a square matrix of booleans (true = dark module), without quiet zone.
 */

export type QrMatrix = readonly (readonly boolean[])[];

/** EC codewords per block, level M, index = version (1–40). */
const ECC_PER_BLOCK_M = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
] as const;
/** Number of EC blocks, level M, index = version (1–40). */
const BLOCKS_M = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25,
  26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
] as const;
/** Format-info bits of level M (L=01, M=00, Q=11, H=10). */
const ECL_M_BITS = 0;

export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 40;

// ---------- Reed–Solomon over GF(2^8) / 0x11D ----------

export function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = gfMul(root, 2);
  }
  return result;
}

/** Reed–Solomon remainder (the EC codewords) of `data` for `degree` EC codewords. */
export function rsRemainder(data: readonly number[], degree: number): number[] {
  const divisor = rsDivisor(degree);
  const result = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0);
    result.push(0);
    for (let i = 0; i < degree; i += 1) result[i]! ^= gfMul(divisor[i]!, factor);
  }
  return result;
}

// ---------- capacity ----------

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

/** Data codewords (bytes) available at a version, level M. */
export function dataCodewords(ver: number): number {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_M[ver]! * BLOCKS_M[ver]!;
}

/** Smallest version whose byte-mode capacity fits `byteLength` bytes; null when it does not fit. */
export function pickVersion(byteLength: number): number | null {
  for (let ver = QR_MIN_VERSION; ver <= QR_MAX_VERSION; ver += 1) {
    const countBits = ver <= 9 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= dataCodewords(ver) * 8) return ver;
  }
  return null;
}

/** Byte-mode data codewords for `bytes` at `ver`: mode + count + data + terminator + padding. */
export function buildDataCodewords(bytes: readonly number[], ver: number): number[] {
  const capacityBits = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  if (bits.length > capacityBits) throw new RangeError('QR: data does not fit the version');
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]!;
    out.push(byte);
  }
  return out;
}

/** Splits data into blocks, appends EC codewords and interleaves them (final codeword sequence). */
export function addEccAndInterleave(data: readonly number[], ver: number): number[] {
  const numBlocks = BLOCKS_M[ver]!;
  const blockEccLen = ECC_PER_BLOCK_M[ver]!;
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const len = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(dat, blockEccLen);
    if (i < numShortBlocks) dat.push(0); // placeholder so every block has the same length
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  const blockLen = blocks[0]?.length ?? 0;
  for (let i = 0; i < blockLen; i += 1) {
    blocks.forEach((block, j) => {
      // Skip the placeholder of the short blocks.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]!);
    });
  }
  return result;
}

// ---------- matrix ----------

export function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** 15 format bits (EC level M + mask) with BCH and the fixed XOR mask applied. */
export function formatBits(mask: number): number {
  const data = (ECL_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** 18 version bits (version ≥ 7) with BCH. */
export function versionBits(ver: number): number {
  let rem = ver;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Mask predicate `mask(x, y)` for mask pattern 0–7 (x = column, y = row). Exported for tests. */
export function maskAt(mask: number, x: number, y: number): boolean {
  return MASKS[mask]!(x, y);
}

interface Grid {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];
}

function createGrid(ver: number): Grid {
  const size = ver * 4 + 17;
  const make = () => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, modules: make(), isFunction: make() };
}

function setFunction(g: Grid, x: number, y: number, dark: boolean): void {
  g.modules[y]![x] = dark;
  g.isFunction[y]![x] = true;
}

function drawFinder(g: Grid, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < g.size && y >= 0 && y < g.size)
        setFunction(g, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1)
      setFunction(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

function drawFormat(g: Grid, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) setFunction(g, 8, i, bit(i));
  setFunction(g, 8, 7, bit(6));
  setFunction(g, 8, 8, bit(7));
  setFunction(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setFunction(g, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i += 1) setFunction(g, g.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setFunction(g, 8, g.size - 15 + i, bit(i));
  setFunction(g, 8, g.size - 8, true); // always-dark module
}

function drawVersion(g: Grid, ver: number): void {
  if (ver < 7) return;
  const bits = versionBits(ver);
  for (let i = 0; i < 18; i += 1) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunction(g, a, b, dark);
    setFunction(g, b, a, dark);
  }
}

function drawFunctionPatterns(g: Grid, ver: number): void {
  for (let i = 0; i < g.size; i += 1) {
    setFunction(g, 6, i, i % 2 === 0);
    setFunction(g, i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, g.size - 4, 3);
  drawFinder(g, 3, g.size - 4);
  const align = alignmentPositions(ver);
  align.forEach((cy, i) => {
    align.forEach((cx, j) => {
      const last = align.length - 1;
      // Not on the three finder corners.
      if (!((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)))
        drawAlignment(g, cx, cy);
    });
  });
  drawFormat(g, 0); // reserves the area; overwritten once the mask is chosen
  drawVersion(g, ver);
}

function drawCodewords(g: Grid, codewords: readonly number[]): void {
  let i = 0;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < g.size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? g.size - 1 - vert : vert;
        if (!g.isFunction[y]![x] && i < codewords.length * 8) {
          g.modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
          i += 1;
        }
        // Remainder bits (if any) stay light.
      }
    }
  }
}

function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y += 1) {
    for (let x = 0; x < g.size; x += 1) {
      if (!g.isFunction[y]![x] && maskAt(mask, x, y)) g.modules[y]![x] = !g.modules[y]![x];
    }
  }
}

// Penalty rules of the standard (N1=3, N2=3, N3=40, N4=10).
function penalty(g: Grid): number {
  const { size, modules } = g;
  let result = 0;
  const lineScore = (get: (i: number) => boolean) => {
    let score = 0;
    let run = 1;
    let bits = 0;
    for (let i = 0; i < size; i += 1) {
      const cur = get(i);
      if (i > 0 && cur === get(i - 1)) {
        run += 1;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
      // Finder-like pattern 1:1:3:1:1 with 4 light modules on either side.
      bits = ((bits << 1) | (cur ? 1 : 0)) & 0x7ff;
      if (i >= 10 && (bits === 0b10111010000 || bits === 0b00001011101)) score += 40;
    }
    return score;
  };
  for (let y = 0; y < size; y += 1) result += lineScore((i) => modules[y]![i]!);
  for (let x = 0; x < size; x += 1) result += lineScore((i) => modules[i]![x]!);
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y]![x];
      if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1])
        result += 3;
    }
  }
  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark += 1;
  const total = size * size;
  result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return result;
}

export interface QrOptions {
  /** Force a mask pattern (0–7) instead of choosing the lowest-penalty one. */
  mask?: number;
  /** Lowest version to use (the encoder grows it when the data needs more room). */
  minVersion?: number;
}

export interface QrCode {
  version: number;
  mask: number;
  size: number;
  modules: QrMatrix;
}

/** Encodes UTF-8 text (byte mode, level M). Throws RangeError when the text is too long. */
export function encodeQrCode(text: string, options: QrOptions = {}): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text));
  const fit = pickVersion(bytes.length);
  if (fit === null) throw new RangeError('QR: text is too long');
  const version = Math.min(QR_MAX_VERSION, Math.max(fit, options.minVersion ?? QR_MIN_VERSION));
  const codewords = addEccAndInterleave(buildDataCodewords(bytes, version), version);

  const base = createGrid(version);
  drawFunctionPatterns(base, version);
  drawCodewords(base, codewords);

  const render = (mask: number): Grid => {
    const g: Grid = {
      size: base.size,
      modules: base.modules.map((row) => row.slice()),
      isFunction: base.isFunction,
    };
    applyMask(g, mask);
    drawFormat(g, mask);
    return g;
  };

  let best: { mask: number; grid: Grid; score: number } | null = null;
  const candidates =
    options.mask !== undefined ? [options.mask & 7] : Array.from({ length: 8 }, (_, i) => i);
  for (const mask of candidates) {
    const grid = render(mask);
    const score = candidates.length === 1 ? 0 : penalty(grid);
    if (!best || score < best.score) best = { mask, grid, score };
  }
  const chosen = best!;
  return { version, mask: chosen.mask, size: chosen.grid.size, modules: chosen.grid.modules };
}

/** Convenience: just the module matrix. */
export function encodeQr(text: string, options?: QrOptions): QrMatrix {
  return encodeQrCode(text, options).modules;
}

/** One SVG path (`M x y h 1 v 1 h -1 z` per dark run) for a matrix, offset by `quiet` modules. */
export function qrPath(modules: QrMatrix, quiet = 0): string {
  let d = '';
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end]) end += 1;
      d += `M${x + quiet} ${y + quiet}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return d;
}
