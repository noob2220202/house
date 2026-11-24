import { mockUuid } from '@/lib/mock';
import { VT_ART } from './_art';

/**
 * 동네TV fixtures (mockdata.md §7). Mirrors the `local_videos` table (admin module) plus three
 * display extras the design needs — `durationSeconds`, `viewCount`, `channelName` — which the
 * backend would have to sync from YouTube (see docs/frontend-integration/w-home.md).
 */
export interface MockVideo {
  key: string;
  /** Fixture age in days — `publishedAt` is derived per request so "3일 전" never goes stale. */
  daysAgo: number;
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
  description: string | null;
  regionCode: string | null;
  complexId: string | null;
  sortOrder: number;
  publishedAt: string;
  durationSeconds: number | null;
  viewCount: number | null;
  channelName: string | null;
}

interface ThumbSpec {
  tone: keyof typeof VT_ART;
  tag: string;
  lines: readonly [string, string];
}

const THUMBS: Record<string, ThumbSpec> = {
  V01: { tone: 'ink', tag: '시세 점검', lines: ['신대 34평,', '지금 사도 될까?'] },
  V02: { tone: 'cobalt', tag: '개발 소식', lines: ['연향들 토지 분양', '핵심만 5분 정리'] },
  V03: { tone: 'reed', tag: '동네 비교', lines: ['오천 vs 선월', '실거주 비교'] },
  V04: { tone: 'soft', tag: '원룸', lines: ['대학가 원룸', '월세 시세 지도'] },
  V05: { tone: 'ink', tag: '분양권', lines: ['선월 하이츠 2차', '프리미엄 흐름'] },
  V06: { tone: 'soft', tag: '생활', lines: ['조례호수공원', '산책로 한 바퀴'] },
};

const DAY_MS = 86_400_000;
const publishedAt = (daysAgo: number, now: number) =>
  new Date(now - daysAgo * DAY_MS - 2 * 3_600_000).toISOString();

function video(
  key: string,
  ytId: string,
  title: string,
  daysAgo: number,
  durationSeconds: number,
  viewCount: number,
  description: string,
): MockVideo {
  return {
    key,
    id: mockUuid(`video-${key}`),
    title,
    youtubeUrl: `https://www.youtube.com/watch?v=${ytId}`,
    youtubeVideoId: ytId,
    thumbnailUrl: `/mock-api/v1/videos/thumb/${key}.svg`,
    description,
    regionCode: null,
    complexId: null,
    sortOrder: Number(key.slice(1)),
    daysAgo,
    publishedAt: publishedAt(daysAgo, Date.now()),
    durationSeconds,
    viewCount,
    channelName: '순천 동네TV',
  };
}

/** Fictional YouTube ids (11 chars) — never resolve to real videos. */
export const VIDEOS: readonly MockVideo[] = [
  video(
    'V01',
    'sc0000000v1',
    '신대지구 34평, 지금 사도 될까? 2026 하반기 시세 점검',
    3,
    872,
    12000,
    '신대 레이크파크 1·3단지 34평 실거래가와 호가를 비교해 봤습니다.',
  ),
  video(
    'V02',
    'sc0000000v2',
    '연향들 도시개발사업 토지 분양, 일정과 위치 핵심 정리',
    7,
    308,
    8940,
    '연향들 도시개발구역 토지 분양 일정과 위치를 5분으로 정리했습니다.',
  ),
  video(
    'V03',
    'sc0000000v3',
    '오천지구 vs 선월지구, 아이 키우는 집 실거주 비교',
    14,
    1127,
    21000,
    '학교, 공원, 상권, 출퇴근 동선까지 두 지구를 직접 다니며 비교했습니다.',
  ),
  video(
    'V04',
    'sc0000000v4',
    '순천 원룸 월세, 순천대·청암대·제일대 앞 시세 지도',
    21,
    555,
    6320,
    '대학가 세 곳의 원룸·투룸 월세 시세를 지도로 정리했습니다.',
  ),
  video(
    'V05',
    'sc0000000v5',
    '선월 하이츠 2차 분양권, 프리미엄은 어디까지 왔나',
    28,
    731,
    15400,
    '입주를 앞둔 선월 하이츠 2차 분양권 프리미엄 흐름을 살펴봅니다.',
  ),
  video(
    'V06',
    'sc0000000v6',
    '조례호수공원 한 바퀴, 호수 앞 단지 살아보니',
    35,
    489,
    4210,
    '조례호수공원 산책로와 주변 단지 생활 환경을 담았습니다.',
  ),
];

/** Public rows of `GET /videos` with `publishedAt` relative to the request time. */
export function listVideos(now: number = Date.now()): Omit<MockVideo, 'key' | 'daysAgo'>[] {
  return VIDEOS.map(({ key: _key, daysAgo, ...v }) => ({
    ...v,
    publishedAt: publishedAt(daysAgo, now),
  }));
}

const FONT = "Inter,'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TONES = {
  ink: { bg: '#0A1222', text: '#FFFFFF', em: '#E9D7A8', tag: '#E9D7A8' },
  cobalt: { bg: '#1D4FF2', text: '#FFFFFF', em: '#FFFFFF', tag: '#FFFFFF' },
  reed: { bg: '#F7F0DE', text: '#0A1222', em: '#7A5C14', tag: '#7A5C14' },
  soft: { bg: '#EEF3FF', text: '#0A1222', em: '#1D4FF2', tag: '#1D4FF2' },
} as const;

/** Stand-in 16:9 thumbnail in the design's four tones (Main.dc.html `.vt`). Real ones come from YouTube. */
export function thumbSvg(key: string): string | null {
  const spec = THUMBS[key];
  if (!spec) return null;
  const t = TONES[spec.tone];
  const w = 320;
  const h = 180;
  const scale = (w * 0.6) / 180;
  const tagW = spec.tag.length * 12 + 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 3}" height="${h * 3}" font-family="${FONT}"><rect width="${w}" height="${h}" fill="${t.bg}"/><g transform="translate(${w - 180 * scale} ${h - 120 * scale}) scale(${scale})">${VT_ART[spec.tone]}</g><rect x="22.5" y="20.5" width="${tagW}" height="21" rx="5" fill="none" stroke="${t.tag}"/><text x="${22.5 + tagW / 2}" y="35.2" text-anchor="middle" font-size="12" font-weight="700" fill="${t.tag}">${esc(spec.tag)}</text><text x="22" y="72" font-size="21" font-weight="800" letter-spacing="-.84" fill="${t.text}">${esc(spec.lines[0])}</text><text x="22" y="98" font-size="21" font-weight="800" letter-spacing="-.84" fill="${t.em}">${esc(spec.lines[1])}</text></svg>`;
}
