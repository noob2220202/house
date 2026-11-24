/**
 * Stand-in images for the mock API (dev only): listing photos and report evidence are served as
 * small generated SVGs so the photo strips / evidence viewers have something to show without a
 * media backend. Real photos come from the backend media URLs (/media/…).
 */
const SKIES: [string, string][] = [
  ['#dce6ff', '#f8f9fb'],
  ['#f3e8cc', '#fbfaf6'],
  ['#e1eee5', '#f8f9fb'],
  ['#d9e7f8', '#f2f4f6'],
  ['#f1ecfd', '#f8f9fb'],
];

export function mockPhotoSvg(seed: number, kind: 'exterior' | 'interior', caption: string): string {
  const [top, bottom] = SKIES[seed % SKIES.length]!;
  const scene =
    kind === 'exterior'
      ? Array.from({ length: 5 }, (_, i) => {
          const h = 150 + ((seed * 37 + i * 61) % 170);
          const x = 40 + i * 150;
          const windows = Array.from({ length: Math.floor(h / 34) }, (_, r) =>
            [0, 1, 2]
              .map(
                (c) =>
                  `<rect x="${x + 16 + c * 30}" y="${470 - h + 18 + r * 30}" width="16" height="14" rx="2" fill="#fff" opacity=".7"/>`,
              )
              .join(''),
          ).join('');
          return `<rect x="${x}" y="${470 - h}" width="116" height="${h}" rx="6" fill="${i % 2 ? '#b9ccff' : '#8b95a1'}" opacity=".85"/>${windows}`;
        }).join('') + '<rect y="470" width="800" height="130" fill="#e1eee5"/>'
      : `<rect y="400" width="800" height="200" fill="#e9d7a8" opacity=".55"/>
<rect x="70" y="120" width="260" height="210" rx="8" fill="#fff" stroke="#b0b8c1" stroke-width="6"/>
<path d="M200 120v210M70 225h260" stroke="#b0b8c1" stroke-width="5"/>
<rect x="430" y="300" width="300" height="130" rx="18" fill="#8b95a1" opacity=".8"/>
<rect x="450" y="262" width="260" height="70" rx="16" fill="#b0b8c1"/>
<rect x="560" y="110" width="110" height="80" rx="6" fill="#dce6ff" stroke="#8b95a1" stroke-width="4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" font-family="'Noto Sans KR','Malgun Gothic',sans-serif">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
${scene}
<rect x="20" y="20" width="${40 + caption.length * 17}" height="38" rx="19" fill="#0a1222" opacity=".72"/>
<text x="40" y="46" font-size="18" font-weight="700" fill="#fff">${caption.replace(/[<>&]/g, '')}</text>
</svg>`;
}

/** A fake phone screenshot (chat with an office) used as report evidence. */
export function mockScreenshotSvg(lines: string[]): string {
  const bubbles = lines
    .map((l, i) => {
      const mine = i % 2 === 1;
      const w = Math.min(300, 40 + l.length * 17);
      const x = mine ? 380 - w : 20;
      return `<rect x="${x}" y="${96 + i * 78}" width="${w}" height="54" rx="18" fill="${mine ? '#1d4ff2' : '#fff'}" stroke="${mine ? 'none' : '#e5e8eb'}"/>
<text x="${x + 18}" y="${129 + i * 78}" font-size="16" fill="${mine ? '#fff' : '#0a1222'}">${l.replace(/[<>&]/g, '')}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 700" width="400" height="700" font-family="'Noto Sans KR','Malgun Gothic',sans-serif">
<rect width="400" height="700" fill="#f2f4f6"/>
<rect width="400" height="64" fill="#fff"/><line y1="64" y2="64" x2="400" stroke="#e5e8eb"/>
<text x="200" y="40" text-anchor="middle" font-size="17" font-weight="700" fill="#0a1222">문의 대화 (견본)</text>
${bubbles}
<text x="200" y="676" text-anchor="middle" font-size="13" fill="#8b95a1">개발용 견본 이미지 (MOCK)</text>
</svg>`;
}

export const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
} as const;
