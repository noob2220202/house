/**
 * Mock creatives. In production a banner / popup is an uploaded image; the mock renders stand-in SVG
 * images in the advertiser's own palette (advertiser colours live only inside the ad frame).
 * Served by `banners/creative/[name]` and `popups/creative/[name]` (mock-only routes).
 */
export interface CreativeSpec {
  ground: string;
  accent: string;
  kicker?: string;
  /** Headline lines (max 2). */
  headline: readonly [string, string?];
  /** One-line headline for narrow / small frames. */
  short?: string;
  motif?: 'skyline' | 'box' | 'check' | 'pin' | 'bell' | 'office' | 'none';
  badge?: string;
}

const FONT = "Inter,'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Line-art motifs drawn in a 160 × 120 box. */
const MOTIFS: Record<Exclude<NonNullable<CreativeSpec['motif']>, 'none'>, string> = {
  skyline:
    '<path d="M22 112V46h28v66M62 112V18h36v94M110 112V58h24v54"/><path d="M30 58h12M30 70h12M30 82h12M30 94h12M70 30h20M70 42h20M70 54h20M70 66h20M70 78h20M70 90h20M116 70h12M116 82h12M116 94h12"/><path d="M8 112h144"/>',
  box: '<rect x="46" y="48" width="70" height="52" rx="4"/><path d="M46 66h70M81 48v52"/><path d="M30 100h106"/><path d="M62 48V32h38v16"/><path d="M124 34l6-6M132 44h8M122 22v-8" opacity=".8"/>',
  check: '<circle cx="80" cy="60" r="38"/><path d="M64 60l12 12 22-25" stroke-width="4.5"/>',
  pin: '<path d="M80 108c22-24 34-41 34-58a34 34 0 0 0-68 0c0 17 12 34 34 58z"/><circle cx="80" cy="50" r="12"/><path d="M30 110h100" opacity=".6"/>',
  bell: '<path d="M52 84V58a28 28 0 0 1 56 0v26l10 12H42z"/><path d="M70 102a10 10 0 0 0 20 0"/><path d="M80 22v8M118 34l6-6M36 28l6 6" opacity=".8"/>',
  office:
    '<path d="M28 108V52l52-32 52 32v56"/><path d="M20 108h120"/><rect x="66" y="72" width="28" height="36" rx="2"/><path d="M44 64h14v14H44zM102 64h14v14h-14z"/>',
};

function waves(w: number, h: number, accent: string): string {
  const lines = Array.from({ length: 4 }, (_, i) => {
    const y = h - i * h * 0.045;
    return `<path d="M${-w * 0.05} ${y} C ${w * 0.22} ${y - h * 0.26 - i * 4} ${w * 0.55} ${y - h * 0.04} ${w * 1.05} ${y - h * 0.3 - i * 6}"/>`;
  }).join('');
  return `<g fill="none" stroke="${accent}" stroke-width="${Math.max(1, h / 180)}" opacity=".32">${lines}</g>`;
}

/** Stand-in creative for a `w × h` frame — layout adapts to the aspect ratio. */
export function creativeSvg(c: CreativeSpec, w: number, h: number): string {
  const ratio = w / h;
  const wide = ratio >= 3;
  const raw: readonly (string | undefined)[] =
    wide && ratio >= 6 && c.short ? [c.short] : c.headline;
  const lines = raw.filter((l): l is string => !!l);
  const hSize = wide ? Math.round(h * (ratio >= 6 ? 0.26 : 0.15)) : Math.round(w * 0.082);
  const kSize = Math.max(12, Math.round(hSize * 0.44));
  const lh = Math.round(hSize * 1.28);
  const left = Math.round(w * (wide ? 0.06 : 0.08));
  const hasKicker = !!c.kicker && !(wide && ratio >= 8);
  const blockH = (hasKicker ? kSize * 1.9 : 0) + lines.length * lh;
  let y = wide ? Math.round((h - blockH) / 2) : Math.round(h * 0.14);
  const parts: string[] = [
    `<rect width="${w}" height="${h}" fill="${c.ground}"/>`,
    waves(w, h, c.accent),
  ];

  if (c.motif && c.motif !== 'none') {
    const mh = wide ? h * 0.86 : h * 0.42;
    const scale = mh / 120;
    const mx = wide ? w - w * 0.07 - 160 * scale : w - w * 0.08 - 160 * scale;
    const my = wide ? (h - mh) / 2 : h - mh - h * 0.1;
    parts.push(
      `<g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) scale(${scale.toFixed(3)})" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${MOTIFS[c.motif]}</g>`,
    );
  }
  if (c.badge && !wide) {
    const bw = c.badge.length * kSize * 1.05 + kSize * 1.2;
    parts.push(
      `<rect x="${left}" y="${y}" width="${bw.toFixed(0)}" height="${(kSize * 1.9).toFixed(0)}" rx="${kSize * 0.35}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${Math.max(1, kSize / 12)}"/>`,
      `<text x="${left + kSize * 0.6}" y="${y + kSize * 1.32}" font-size="${kSize}" font-weight="700" fill="#fff">${esc(c.badge)}</text>`,
    );
    y += Math.round(kSize * 2.9);
  }
  if (hasKicker && c.kicker) {
    parts.push(
      `<text x="${left}" y="${y + kSize}" font-size="${kSize}" font-weight="700" fill="${c.accent}" opacity=".95">${esc(c.kicker)}</text>`,
    );
    y += Math.round(kSize * 1.9);
  }
  lines.forEach((line, i) => {
    parts.push(
      `<text x="${left}" y="${y + i * lh + Math.round(hSize * 0.9)}" font-size="${hSize}" font-weight="800" letter-spacing="${(-0.04 * hSize).toFixed(1)}" fill="#fff">${esc(line)}</text>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">${parts.join('')}</svg>`;
}
