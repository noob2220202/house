/**
 * Props for `next/image` from a backend media URL.
 * The Next image optimizer is switched off (next.config.mjs `images.unoptimized`): backend media are
 * already webp variants in fixed sizes (thumb / medium / large), served by nginx. `unoptimized`
 * still tells which sources the optimizer *could* take (`/media/**` and NEXT_PUBLIC_MEDIA_HOSTS)
 * should it ever be switched back on — mock stand-ins under `/mock-api`, SVGs and YouTube
 * thumbnails never are.
 */
const MEDIA_ORIGINS = (process.env.NEXT_PUBLIC_MEDIA_HOSTS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

export function isOptimizableImage(
  src: string,
  origins: readonly string[] = MEDIA_ORIGINS,
): boolean {
  if (/\.svg(\?|#|$)/i.test(src)) return false;
  if (src.startsWith('/')) return src.startsWith('/media/');
  return origins.some((origin) => src === origin || src.startsWith(`${origin}/`));
}

export function imageProps(src: string): { src: string; unoptimized: boolean } {
  return { src, unoptimized: !isOptimizableImage(src) };
}
