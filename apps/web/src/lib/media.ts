/**
 * Props for `next/image` from a backend media URL.
 * The optimizer only accepts the backend media path (`/media/**`, next.config `localPatterns`,
 * fetched from MEDIA_ORIGIN) and hosts listed in NEXT_PUBLIC_MEDIA_HOSTS. Anything else — mock
 * stand-ins under `/mock-api`, SVGs, YouTube thumbnails — is rendered unoptimized instead of
 * failing at runtime.
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
