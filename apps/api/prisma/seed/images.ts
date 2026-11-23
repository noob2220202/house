import { createHash } from 'node:crypto';
import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_VARIANTS, type ImageVariant } from '@house/shared';
import { MediaStatus, MediaVisibility, type MediaPurpose, type PrismaClient } from '@prisma/client';
import sharp from 'sharp';

export interface SeedImage {
  id: string;
  /** Unique file stem: img/seed/<name>.webp (+ _thumb/_medium/_large variants). */
  name: string;
  purpose: MediaPurpose;
  width: number;
  height: number;
  label: string;
  color: string;
}

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );

function svg(img: SeedImage): Buffer {
  // ASCII only: the build host may have no Hangul font for librsvg.
  const fontSize = Math.max(14, Math.round(Math.min(img.width, img.height) / 9));
  const label = img.label.replace(/[<>&"]/g, '');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${img.color}"/><stop offset="1" stop-color="#1f2937"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="${fontSize}" fill="#ffffff"
        text-anchor="middle" dominant-baseline="middle">${label}</text>
      <text x="50%" y="${Math.round(img.height * 0.85)}" font-family="sans-serif"
        font-size="${Math.round(fontSize / 2.2)}" fill="#e5e7eb" text-anchor="middle">SAMPLE ${img.width}x${img.height}</text>
    </svg>`,
  );
}

async function writeAtomic(target: string, data: Buffer): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}`;
  await writeFile(tmp, data, { mode: 0o644 });
  await rename(tmp, target);
}

/**
 * Renders a placeholder webp (+ the same thumb/medium/large variants the media worker makes) into
 * UPLOAD_DIR and upserts its READY media row. Files are only written when missing.
 */
export async function ensureImage(
  prisma: PrismaClient,
  uploadDir: string,
  img: SeedImage,
): Promise<string> {
  const key = `img/seed/${img.name}.webp`;
  const original = await sharp(svg(img)).webp({ quality: 80 }).toBuffer();
  const variants: Partial<Record<ImageVariant, { key: string; width: number; height: number }>> =
    {};
  for (const [name, spec] of Object.entries(IMAGE_VARIANTS) as [
    ImageVariant,
    (typeof IMAGE_VARIANTS)[ImageVariant],
  ][]) {
    const vKey = key.replace(/\.webp$/, `_${name}.webp`);
    const target = path.join(uploadDir, vKey);
    const pipeline = sharp(original).resize({
      width: spec.width,
      height: spec.height,
      fit: spec.fit,
      withoutEnlargement: true,
    });
    const { data, info } = await pipeline
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
    if (!(await exists(target))) await writeAtomic(target, data);
    variants[name] = { key: vKey, width: info.width, height: info.height };
  }
  const originalPath = path.join(uploadDir, key);
  if (!(await exists(originalPath))) await writeAtomic(originalPath, original);
  const data = {
    purpose: img.purpose,
    visibility: MediaVisibility.PUBLIC,
    status: MediaStatus.READY,
    mimeType: 'image/webp',
    sizeBytes: original.length,
    width: img.width,
    height: img.height,
    sha256: createHash('sha256').update(original).digest('hex'),
    storageKey: key,
    variants,
  };
  await prisma.media.upsert({ where: { id: img.id }, update: {}, create: { id: img.id, ...data } });
  return img.id;
}
