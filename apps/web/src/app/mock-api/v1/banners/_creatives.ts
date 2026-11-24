import { AD_ART_SKYLINE } from './_art';

/**
 * Mock banner creatives. In production a banner is an uploaded image (pc + mobile media); the mock
 * renders stand-in SVG images in the advertiser's own palette so screens match the design drafts.
 * Served by `banners/creative/[name]/route.ts` (mock-only route).
 */
export interface CreativeSpec {
  /** Advertiser palette (never BRAND ink/champagne unless it is a house ad). */
  ground: string;
  accent: string;
  kicker: string;
  /** Headline lines (max 2). */
  headline: readonly [string, string?];
  sub?: string;
  cta?: string;
  /** Advertiser byline drawn inside the narrow strip creatives only — on the wide hero banner the
   *  site prints `advertiserName` as chrome next to the pager. */
  advertiser?: string;
  /** One-line headline for the narrow mobile strip (750 × 200). */
  mobileHeadline?: string;
  /** Draw the line-art skyline on the right. */
  skyline?: boolean;
  /**
   * Overrides for the 358 × 160 mobile creative — advertisers upload a separate mobile image, so
   * it may use another ground (MobileHome draws AD-01 on the default ink ad ground).
   */
  mobile?: { ground?: string; accent?: string };
}

const FONT = "Inter,'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" font-family="${FONT}">${body}</svg>`;
}

function skyline(x: number, y: number, scale: number, stroke: string): string {
  const art = AD_ART_SKYLINE.replace(/#F4E9DC/g, stroke);
  return `<g transform="translate(${x} ${y}) scale(${scale})">${art}</g>`;
}

/** Wide desktop creative (main 1240×220, strip 1200×120, search-top 1200×150 …). */
export function wideCreative(c: CreativeSpec, w = 1240, h = 220): string {
  const compact = h < 180;
  const left = Math.round(w * 0.06);
  const lines = c.headline.filter((l): l is string => !!l);
  const hSize = compact ? 22 : 32;
  const lh = Math.round(hSize * 1.25);
  const blocks: string[] = [];
  let height = 0;
  const kH = 20;
  const subH = c.sub && !compact ? 21 : 0;
  const ctaH = c.cta && !compact ? 38 : 0;
  height = kH + 10 + lines.length * lh + (subH ? 10 + subH : 0) + (ctaH ? 14 + ctaH : 0);
  let y = Math.round((h - height) / 2);
  blocks.push(
    `<text x="${left}" y="${y + 14}" font-size="13" font-weight="700" letter-spacing=".26" fill="${c.accent}" opacity=".92">${esc(c.kicker)}</text>`,
  );
  y += kH + 10;
  lines.forEach((line, i) => {
    blocks.push(
      `<text x="${left}" y="${y + i * lh + Math.round(hSize * 0.92)}" font-size="${hSize}" font-weight="800" letter-spacing="${-0.04 * hSize}" fill="#fff">${esc(line)}</text>`,
    );
  });
  y += lines.length * lh;
  if (subH && c.sub) {
    y += 10;
    blocks.push(
      `<text x="${left}" y="${y + 15}" font-size="14" fill="#fff" opacity=".78">${esc(c.sub)}</text>`,
    );
    y += subH;
  }
  if (ctaH && c.cta) {
    y += 14;
    const tw = Math.round(c.cta.length * 13.2) + 42;
    blocks.push(
      `<rect x="${left}" y="${y}" width="${tw}" height="38" rx="19" fill="${c.accent}"/>`,
      `<text x="${left + 16}" y="${y + 24}" font-size="14" font-weight="800" fill="#0A1222">${esc(c.cta)}</text>`,
      `<path d="M${left + tw - 28} ${y + 19}h11m-4.5-4.5 4.5 4.5-4.5 4.5" fill="none" stroke="#0A1222" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  if (c.cta && compact) {
    const tw = Math.round(c.cta.length * 13.2) + 32;
    const x = w - 96 - tw;
    blocks.push(
      `<rect x="${x}" y="${h / 2 - 19}" width="${tw}" height="38" rx="19" fill="${c.accent}"/>`,
      `<text x="${x + tw / 2}" y="${h / 2 + 5}" text-anchor="middle" font-size="14" font-weight="800" fill="#0A1222">${esc(c.cta)}</text>`,
    );
  }
  const art = c.skyline && !compact ? skyline(w - 520 * (h / 220), 0, h / 220, c.accent) : '';
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${c.ground}"/>${art}${blocks.join('')}`);
}

/** Mobile creative (358×160): copy bottom-left, small skyline. */
export function mobileCreative(spec: CreativeSpec, w = 358, h = 160): string {
  const c: CreativeSpec = {
    ...spec,
    ground: spec.mobile?.ground ?? spec.ground,
    accent: spec.mobile?.accent ?? spec.accent,
  };
  const lines = c.headline.filter((l): l is string => !!l);
  const hSize = 19;
  const lh = Math.round(hSize * 1.3);
  const bottom = h - 18;
  const headTop = bottom - lines.length * lh;
  const blocks: string[] = [];
  lines.forEach((line, i) => {
    blocks.push(
      `<text x="18" y="${headTop + i * lh + 19}" font-size="${hSize}" font-weight="800" letter-spacing="${-0.04 * hSize}" fill="#fff">${esc(line)}</text>`,
    );
  });
  blocks.push(
    `<text x="18" y="${headTop - 10}" font-size="12" font-weight="700" letter-spacing=".24" fill="${c.accent}" opacity=".92">${esc(c.kicker)}</text>`,
  );
  const scale = (w * 0.5) / 520;
  const art = c.skyline ? skyline(w - 520 * scale, h - 220 * scale, scale, c.accent) : '';
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${c.ground}"/>${art}${blocks.join('')}`);
}

/** Box creative (side 300×250, map card 360×200, featured agency 360×120). */
export function boxCreative(c: CreativeSpec, w = 300, h = 250): string {
  const lines = c.headline.filter((l): l is string => !!l);
  const hSize = h < 160 ? 18 : 22;
  const lh = Math.round(hSize * 1.3);
  const top = h < 160 ? 44 : 64;
  const blocks = [
    `<text x="20" y="${top}" font-size="12" font-weight="700" fill="${c.accent}" opacity=".92">${esc(c.kicker)}</text>`,
    ...lines.map(
      (line, i) =>
        `<text x="20" y="${top + 14 + (i + 1) * lh - 6}" font-size="${hSize}" font-weight="800" letter-spacing="${-0.04 * hSize}" fill="#fff">${esc(line)}</text>`,
    ),
  ];
  if (c.sub && h >= 200) {
    blocks.push(
      `<text x="20" y="${top + 14 + lines.length * lh + 20}" font-size="13" fill="#fff" opacity=".78">${esc(c.sub)}</text>`,
    );
  }
  const scale = (w * 0.62) / 520;
  const art =
    c.skyline && h >= 200 ? skyline(w - 520 * scale, h - 220 * scale, scale, c.accent) : '';
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${c.ground}"/>${art}${blocks.join('')}`);
}

/** Mobile strip creative (750 × 200 → 375 × 100): advertiser next to the AD badge, one headline. */
export function mobileStripCreative(c: CreativeSpec, w = 375, h = 100): string {
  const blocks = [
    `<text x="18" y="${h - 22}" font-size="17" font-weight="800" letter-spacing="-.68" fill="#fff">${esc(c.mobileHeadline ?? c.headline[0])}</text>`,
  ];
  if (c.advertiser) {
    blocks.push(
      `<text x="58" y="30" font-size="12" font-weight="700" letter-spacing=".24" fill="${c.accent}">${esc(c.advertiser)}</text>`,
    );
  }
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${c.ground}"/>${blocks.join('')}`);
}
