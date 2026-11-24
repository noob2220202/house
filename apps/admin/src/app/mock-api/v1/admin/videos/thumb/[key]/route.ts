import { NextResponse, type NextRequest } from 'next/server';
import { VIDEO_THUMBS } from '@/features/m-content/mock/fixtures-content';
import { mockGuard } from '@/lib/mock';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// MOCK ONLY: drawn thumbnail for the fixture videos (their YouTube ids are fictional).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { key } = await params;
  const art = VIDEO_THUMBS[key];
  if (!art) return new NextResponse('Not Found', { status: 404 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" font-family="Inter, 'Noto Sans KR', sans-serif">
<rect width="480" height="270" fill="${art.tone}"/>
<circle cx="408" cy="42" r="120" fill="#fff" opacity=".06"/>
<circle cx="60" cy="270" r="150" fill="#fff" opacity=".05"/>
<rect x="28" y="30" rx="14" width="${art.tag.length * 17 + 28}" height="28" fill="#e9d7a8"/>
<text x="42" y="50" font-size="15" font-weight="800" fill="#0a1222">${esc(art.tag)}</text>
<text x="28" y="186" font-size="36" font-weight="800" fill="#fff" letter-spacing="-1.4">${esc(art.lines[0])}</text>
<text x="28" y="230" font-size="36" font-weight="800" fill="#e9d7a8" letter-spacing="-1.4">${esc(art.lines[1])}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
