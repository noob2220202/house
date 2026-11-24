/**
 * next/image props for a backend media URL. Mock photos / banner creatives are SVG route handlers,
 * which the image optimizer refuses — they are served as-is.
 */
export function mediaImage(url: string): { src: string; unoptimized: boolean } {
  return { src: url, unoptimized: url.startsWith('/mock-api/') || /\.svg(\?|$)/.test(url) };
}
