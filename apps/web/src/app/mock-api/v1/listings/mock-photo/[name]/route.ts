import type { NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';

/**
 * MOCK-ONLY: stand-in listing photos ("<scene>-<variant>"), drawn as flat SVG illustrations in the
 * style of the design's photo stand-ins. The real backend returns media URLs of uploaded photos.
 */
const PALETTES = [
  {
    sky: '#E6EDFA',
    wall: '#F3F5F9',
    accent: '#1D4FF2',
    warm: '#E9D7A8',
    floor: '#D8C9B0',
    ink: '#111B2E',
  },
  {
    sky: '#EAF1F4',
    wall: '#F4F3EF',
    accent: '#06664A',
    warm: '#F1D9B5',
    floor: '#CDBFA8',
    ink: '#1B2740',
  },
  {
    sky: '#F0ECFA',
    wall: '#F6F4F8',
    accent: '#4A26A8',
    warm: '#EFD8C4',
    floor: '#D4C4B4',
    ink: '#1F2836',
  },
  {
    sky: '#FBEFE6',
    wall: '#F8F5F1',
    accent: '#C2410C',
    warm: '#F3E8CC',
    floor: '#D9C7AC',
    ink: '#2A3752',
  },
  {
    sky: '#E3EEF9',
    wall: '#F2F4F6',
    accent: '#1539C4',
    warm: '#E6D3B8',
    floor: '#C9BBA6',
    ink: '#0A1222',
  },
  {
    sky: '#E8F0EA',
    wall: '#F5F6F2',
    accent: '#3F6B50',
    warm: '#EBDDBE',
    floor: '#D2C3AA',
    ink: '#1B2740',
  },
] as const;
type Palette = (typeof PALETTES)[number];

const W = 800;
const H = 600;

function tower(x: number, y: number, w: number, h: number, p: Palette): string {
  const cols = Math.max(3, Math.floor(w / 18));
  const rows = Math.floor((h - 24) / 16);
  let windows = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const wx = x + 8 + c * ((w - 16) / cols);
      windows += `<rect x="${wx.toFixed(1)}" y="${y + 14 + r * 16}" width="${((w - 16) / cols - 5).toFixed(1)}" height="8" rx="1" fill="${p.accent}" opacity=".34"/>`;
    }
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><rect x="${x + w}" y="${y}" width="${Math.round(w * 0.26)}" height="${h}" fill="${p.accent}" opacity=".2"/><rect x="${x}" y="${y - 5}" width="${Math.round(w * 1.26)}" height="5" fill="${p.accent}" opacity=".3"/>${windows}`;
}

const tree = (x: number, y: number, p: Palette) =>
  `<rect x="${x - 2}" y="${y}" width="4" height="26" fill="#8C97A8"/><circle cx="${x}" cy="${y - 6}" r="17" fill="${p.accent === '#1D4FF2' ? '#9DC3A8' : '#A9CBB1'}"/>`;

const windowPane = (x: number, y: number, w: number, h: number, p: Palette) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.sky}"/><path d="M${x} ${y + h * 0.72} C${x + w * 0.3} ${y + h * 0.6} ${x + w * 0.6} ${y + h * 0.78} ${x + w} ${y + h * 0.64} V${y + h} H${x}z" fill="#BFD8C6"/><circle cx="${x + w * 0.78}" cy="${y + h * 0.26}" r="${h * 0.09}" fill="#fff" opacity=".9"/><path d="M${x + w / 2} ${y}V${y + h}M${x} ${y + h * 0.5}H${x + w}" stroke="#fff" stroke-width="6"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#fff" stroke-width="10"/>`;

const SCENES: Record<string, (p: Palette) => string> = {
  exterior: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.sky}"/><circle cx="660" cy="110" r="46" fill="#fff" opacity=".8"/>` +
    tower(70, 200, 96, 280, p) +
    tower(230, 120, 110, 360, p) +
    tower(420, 170, 100, 310, p) +
    tower(590, 230, 90, 250, p) +
    `<path d="M0 470 C160 446 300 462 440 438 S680 432 800 448 V600 H0z" fill="#CBD7EE"/><path d="M0 520 C200 500 420 530 800 500 V600 H0z" fill="#B7C8E8"/>` +
    tree(40, 452, p) +
    tree(200, 446, p) +
    tree(390, 440, p) +
    tree(560, 444, p) +
    tree(740, 450, p),
  living: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.wall}"/>` +
    windowPane(90, 70, 400, 300, p) +
    `<rect x="470" y="60" width="54" height="330" fill="${p.warm}" opacity=".75"/><rect y="420" width="${W}" height="180" fill="${p.floor}"/>` +
    `<rect x="110" y="352" width="340" height="96" rx="18" fill="${p.ink}"/><rect x="96" y="388" width="368" height="74" rx="16" fill="${p.ink}"/><rect x="150" y="340" width="110" height="60" rx="12" fill="${p.accent}" opacity=".85"/><rect x="290" y="340" width="110" height="60" rx="12" fill="#fff" opacity=".85"/>` +
    `<ellipse cx="420" cy="520" rx="250" ry="38" fill="#fff" opacity=".55"/><rect x="560" y="430" width="150" height="16" rx="8" fill="#B79F7C"/><rect x="574" y="446" width="8" height="60" fill="#B79F7C"/><rect x="688" y="446" width="8" height="60" fill="#B79F7C"/>` +
    `<path d="M640 150 V330" stroke="${p.ink}" stroke-width="5"/><path d="M604 150 h72 l-14 -46 h-44z" fill="${p.warm}"/>`,
  kitchen: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.wall}"/><rect y="440" width="${W}" height="160" fill="${p.floor}"/>` +
    `<rect x="60" y="70" width="680" height="120" fill="#fff"/><path d="M230 70V190M400 70V190M570 70V190" stroke="${p.wall}" stroke-width="6"/>` +
    `<rect x="60" y="220" width="680" height="60" fill="${p.accent}" opacity=".12"/><rect x="60" y="280" width="680" height="18" fill="#C9CED6"/><rect x="60" y="298" width="680" height="150" fill="${p.ink}"/><path d="M230 298V448M400 298V448M570 298V448" stroke="#fff" stroke-opacity=".14" stroke-width="4"/>` +
    `<rect x="300" y="236" width="90" height="40" rx="6" fill="#DDE2EA"/><path d="M345 236v-30h26" stroke="#8C97A8" stroke-width="6" fill="none"/><rect x="520" y="262" width="110" height="16" rx="4" fill="#3A4558"/>` +
    `<path d="M250 0V44M400 0V58M550 0V44" stroke="${p.ink}" stroke-width="3"/><circle cx="250" cy="56" r="14" fill="${p.warm}"/><circle cx="400" cy="70" r="14" fill="${p.warm}"/><circle cx="550" cy="56" r="14" fill="${p.warm}"/>`,
  plan: (p) =>
    `<rect width="${W}" height="${H}" fill="#FBFCFE"/><g fill="none" stroke="${p.ink}" stroke-width="7" stroke-linejoin="round"><path d="M150 110H650V490H150z"/><path d="M150 300H400V110M400 300V490M520 300H650M520 300V380"/></g>` +
    `<g fill="${p.accent}" opacity=".1"><rect x="154" y="114" width="242" height="182"/><rect x="404" y="114" width="242" height="182"/></g>` +
    `<g fill="none" stroke="#8C97A8" stroke-width="3"><path d="M400 380 a54 54 0 0 1 54 -54"/><path d="M270 300 a48 48 0 0 0 -48 48"/><rect x="560" y="400" width="60" height="60" rx="8"/><rect x="190" y="150" width="120" height="90" rx="6"/><circle cx="596" cy="150" r="16"/></g>` +
    `<circle cx="690" cy="90" r="20" fill="none" stroke="${p.ink}" stroke-width="3"/><path d="M690 104V76l-7 12h14z" fill="${p.ink}"/>`,
  view: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.sky}"/><circle cx="600" cy="130" r="54" fill="#fff" opacity=".85"/><path d="M0 330 C150 280 300 320 430 290 S690 270 800 300 V600 H0z" fill="#BFD8C6"/><ellipse cx="380" cy="430" rx="300" ry="70" fill="#C9DCF5"/><ellipse cx="380" cy="424" rx="230" ry="44" fill="#D9E7F8"/>` +
    tree(90, 380, p) +
    tree(680, 372, p) +
    tree(600, 400, p) +
    `<rect y="500" width="${W}" height="100" fill="${p.ink}" opacity=".9"/><path d="M0 500H800" stroke="#fff" stroke-opacity=".5" stroke-width="6"/><g stroke="#fff" stroke-opacity=".28" stroke-width="5"><path d="M80 500V600M240 500V600M400 500V600M560 500V600M720 500V600"/></g>`,
  bedroom: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.wall}"/>` +
    windowPane(480, 80, 240, 220, p) +
    `<rect y="440" width="${W}" height="160" fill="${p.floor}"/><rect x="90" y="250" width="360" height="110" rx="14" fill="${p.warm}"/><rect x="70" y="340" width="400" height="130" rx="16" fill="#fff"/><rect x="70" y="400" width="400" height="80" rx="14" fill="${p.accent}" opacity=".8"/><rect x="110" y="322" width="120" height="50" rx="14" fill="#fff"/><rect x="290" y="322" width="120" height="50" rx="14" fill="#fff"/>` +
    `<rect x="520" y="390" width="110" height="90" rx="8" fill="#B79F7C"/><path d="M575 390V320" stroke="${p.ink}" stroke-width="5"/><path d="M545 322h60l-12 -40h-36z" fill="${p.warm}"/>`,
  bath: (p) =>
    `<rect width="${W}" height="${H}" fill="#EEF2F6"/><g stroke="#fff" stroke-width="4"><path d="M0 120H800M0 240H800M0 360H800M160 0V440M320 0V440M480 0V440M640 0V440"/></g><rect y="440" width="${W}" height="160" fill="#C8CFD9"/>` +
    `<rect x="90" y="110" width="220" height="190" rx="12" fill="${p.sky}" stroke="#fff" stroke-width="10"/><rect x="70" y="340" width="260" height="26" rx="8" fill="#fff"/><rect x="90" y="366" width="220" height="110" fill="${p.ink}"/><path d="M200 340v-34h30" stroke="#8C97A8" stroke-width="7" fill="none"/>` +
    `<path d="M420 380h320v70a40 40 0 0 1 -40 40H460a40 40 0 0 1 -40 -40z" fill="#fff"/><rect x="408" y="366" width="344" height="22" rx="11" fill="#fff"/><path d="M700 366V220a30 30 0 0 0 -60 0" stroke="#8C97A8" stroke-width="7" fill="none"/><rect x="560" y="130" width="14" height="120" rx="7" fill="${p.accent}" opacity=".7"/>`,
  entrance: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.wall}"/><rect y="470" width="${W}" height="130" fill="#C8CFD9"/><g stroke="#fff" stroke-width="4"><path d="M0 530H800M200 470V600M400 470V600M600 470V600"/></g>` +
    `<rect x="300" y="90" width="200" height="380" rx="6" fill="${p.ink}"/><rect x="322" y="116" width="156" height="150" rx="4" fill="#fff" opacity=".08"/><rect x="460" y="270" width="12" height="52" rx="6" fill="${p.warm}"/>` +
    `<rect x="560" y="210" width="180" height="260" fill="#fff"/><path d="M650 210V470M560 300H740M560 390H740" stroke="${p.wall}" stroke-width="5"/><rect x="80" y="330" width="150" height="140" rx="8" fill="#B79F7C"/><circle cx="155" cy="290" r="38" fill="#A9CBB1"/>`,
  room: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.wall}"/>` +
    windowPane(300, 70, 240, 210, p) +
    `<rect y="430" width="${W}" height="170" fill="${p.floor}"/><rect x="50" y="330" width="290" height="130" rx="14" fill="#fff"/><rect x="50" y="380" width="290" height="88" rx="12" fill="${p.accent}" opacity=".8"/><rect x="70" y="318" width="100" height="46" rx="12" fill="#fff"/>` +
    `<rect x="470" y="340" width="260" height="16" rx="6" fill="#B79F7C"/><rect x="484" y="356" width="10" height="110" fill="#B79F7C"/><rect x="706" y="356" width="10" height="110" fill="#B79F7C"/><rect x="540" y="270" width="110" height="70" rx="6" fill="${p.ink}"/><rect x="588" y="340" width="14" height="0" /><rect x="600" y="80" width="150" height="150" fill="#fff"/><path d="M600 130H750M600 180H750" stroke="${p.wall}" stroke-width="5"/>`,
  villa: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.sky}"/><circle cx="130" cy="110" r="42" fill="#fff" opacity=".8"/><rect y="470" width="${W}" height="130" fill="#D5DBE4"/>` +
    `<rect x="170" y="190" width="460" height="290" fill="#fff"/><rect x="170" y="176" width="460" height="16" fill="${p.accent}" opacity=".5"/><g fill="${p.accent}" opacity=".3"><rect x="206" y="226" width="80" height="54"/><rect x="320" y="226" width="80" height="54"/><rect x="434" y="226" width="80" height="54"/><rect x="528" y="226" width="70" height="54"/><rect x="206" y="316" width="80" height="54"/><rect x="320" y="316" width="80" height="54"/><rect x="434" y="316" width="80" height="54"/><rect x="528" y="316" width="70" height="54"/></g><rect x="360" y="400" width="80" height="80" fill="${p.ink}"/>` +
    tree(90, 450, p) +
    tree(700, 446, p),
  shop: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.sky}"/><rect y="490" width="${W}" height="110" fill="#D5DBE4"/><rect x="90" y="110" width="620" height="380" fill="#fff"/><rect x="90" y="110" width="620" height="70" fill="${p.ink}"/><rect x="130" y="132" width="180" height="26" rx="6" fill="${p.warm}"/>` +
    `<path d="M90 180h620l24 60H66z" fill="${p.accent}" opacity=".8"/><rect x="130" y="270" width="330" height="190" fill="${p.sky}" stroke="${p.ink}" stroke-width="6"/><rect x="510" y="270" width="150" height="220" fill="${p.ink}" opacity=".85"/><rect x="640" y="370" width="8" height="40" rx="4" fill="${p.warm}"/>`,
  land: (p) =>
    `<rect width="${W}" height="${H}" fill="${p.sky}"/><circle cx="640" cy="120" r="50" fill="#fff" opacity=".85"/><path d="M0 300 C140 220 260 280 400 230 S660 210 800 260 V600 H0z" fill="#BFD8C6"/><path d="M0 380 C200 340 520 360 800 330 V600 H0z" fill="#D9E6C8"/>` +
    `<path d="M150 420 L560 390 L700 520 L110 560z" fill="${p.warm}" stroke="${p.accent}" stroke-width="5" stroke-dasharray="14 10"/><path d="M0 560 L800 500 V600 H0z" fill="#C8CFD9"/><path d="M40 578 L800 524" stroke="#fff" stroke-width="5" stroke-dasharray="30 22"/>`,
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { name } = await ctx.params;
  const m = /^([a-z]+)-(\d)$/.exec(name);
  const paint = m ? SCENES[m[1] ?? ''] : undefined;
  if (!m || !paint) return new Response('Not Found', { status: 404 });
  const palette = PALETTES[Number(m[2]) % PALETTES.length] ?? PALETTES[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" preserveAspectRatio="xMidYMid slice">${paint(palette)}</svg>`;
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
