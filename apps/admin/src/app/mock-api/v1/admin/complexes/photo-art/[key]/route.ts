import { NextResponse, type NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';

const SKIES = [
  ['#dce6ff', '#eef3ff'],
  ['#f3e8cc', '#f7f0de'],
  ['#d9e7f8', '#f3f5f8'],
  ['#e1eee5', '#f3f5f8'],
  ['#e5e8eb', '#f8f9fb'],
] as const;

// MOCK ONLY: drawn stand-in for fixture complex photos (real ones are /media/* files).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { key } = await params;
  let h = 0;
  for (const ch of key) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const [top, bottom] = SKIES[h % SKIES.length] ?? SKIES[0];
  const towers = Array.from({ length: 5 }, (_, i) => {
    const w = 46 + ((h >> (i * 3)) % 3) * 8;
    const height = 120 + ((h >> (i * 4)) % 5) * 22;
    const x = 34 + i * 88 + ((h >> i) % 12);
    const y = 300 - height;
    const windows = Array.from({ length: Math.floor(height / 18) - 1 }, (_, r) =>
      [0, 1, 2]
        .map(
          (c) =>
            `<rect x="${x + 7 + c * ((w - 14) / 3)}" y="${y + 12 + r * 18}" width="${(w - 14) / 3 - 4}" height="8" rx="1.5" fill="#fff" opacity=".7"/>`,
        )
        .join(''),
    ).join('');
    return `<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="4" fill="${i % 2 ? '#8b95a1' : '#646f7c'}"/>${windows}`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
<rect width="480" height="320" fill="url(#s)"/>
<circle cx="${380 - (h % 60)}" cy="70" r="26" fill="#fff" opacity=".8"/>
${towers}
<rect y="296" width="480" height="24" fill="#b0b8c1"/>
<ellipse cx="90" cy="298" rx="46" ry="14" fill="#3f6b50" opacity=".55"/>
<ellipse cx="400" cy="300" rx="60" ry="16" fill="#3f6b50" opacity=".45"/>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
