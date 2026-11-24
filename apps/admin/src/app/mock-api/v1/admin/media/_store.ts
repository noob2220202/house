/**
 * In-memory media of the admin mock (globalThis so every route bundle shares it; reset on restart).
 * Real backend: POST /api/v1/admin/media stores the file under UPLOAD_DIR, nginx serves /media/*.
 */
export interface MockMedia {
  id: string;
  purpose: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  /** Public URL of the image (mock creative route or the mock file route for uploads). */
  url: string;
  /** Bytes of an upload made in this session (fixtures have none). */
  bytes?: Uint8Array;
  createdAt: number;
}

const KEY = '__houseAdminMockMedia' as const;
type GlobalWithMedia = typeof globalThis & { [KEY]?: Map<string, MockMedia> };

export const MOCK_MEDIA_LIMIT = 80;

export function mediaStore(): Map<string, MockMedia> {
  const g = globalThis as GlobalWithMedia;
  g[KEY] ??= new Map();
  return g[KEY];
}

export function getMedia(id: string | null | undefined): MockMedia | undefined {
  return id ? mediaStore().get(id) : undefined;
}

/** Registers a fixture image (served by a mock creative route). Idempotent. */
export function registerFixtureMedia(media: Omit<MockMedia, 'createdAt' | 'bytes'>): string {
  const store = mediaStore();
  if (!store.has(media.id)) store.set(media.id, { ...media, createdAt: 0 });
  return media.id;
}

/** MediaDto (packages/shared/src/schemas/media.ts). */
export function toMediaDto(m: MockMedia) {
  const variant = { url: m.url, width: m.width ?? 0, height: m.height ?? 0 };
  return {
    id: m.id,
    purpose: m.purpose,
    mimeType: m.mimeType,
    width: m.width,
    height: m.height,
    variants: { thumb: variant, medium: variant, large: variant },
  };
}

export function mediaDto(id: string | null | undefined) {
  const m = getMedia(id);
  return m ? toMediaDto(m) : null;
}

/** Pixel size from the file header (PNG / JPEG / WebP) — the real backend reads it with sharp. */
export function sniffImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: signature (8) + IHDR length/type (8) + width (4) + height (4)
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments until a start-of-frame marker
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1] ?? 0;
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  }
  // WebP: RIFF....WEBP + VP8X / VP8L / VP8 chunk
  if (bytes.length > 30 && bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    const chunk = String.fromCharCode(
      bytes[12] ?? 0,
      bytes[13] ?? 0,
      bytes[14] ?? 0,
      bytes[15] ?? 0,
    );
    if (chunk === 'VP8X') {
      const w = 1 + ((bytes[24] ?? 0) | ((bytes[25] ?? 0) << 8) | ((bytes[26] ?? 0) << 16));
      const h = 1 + ((bytes[27] ?? 0) | ((bytes[28] ?? 0) << 8) | ((bytes[29] ?? 0) << 16));
      return { width: w, height: h };
    }
    if (chunk === 'VP8L') {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ') {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
  }
  return null;
}
