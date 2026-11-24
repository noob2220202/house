import { DEFAULT_SGG_CODE } from '@house/shared';
import { BRAND, josa } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { absoluteUrl } from './metadata';
import { LANDING_ASSETS, SEO_ROUTES, indexableLandings, landingTitle } from './regions';
import type { SeoRegionIndex, SeoTradeReport } from './schemas';
import { DATA_SOURCES } from './sources';
import { manwonText, ymLabel } from './text';

/*
 * /llms.txt and /llms-full.txt (https://llmstxt.org): what the service is, what it covers, where
 * its numbers come from and which URLs hold which facts — so AI answer engines (ChatGPT,
 * Perplexity, Google AI Overviews, Naver Cue:) can cite the right page. Every figure comes from
 * the API; without data the section is left out instead of guessed.
 */

export interface LlmsInput {
  index: SeoRegionIndex | null;
  report: SeoTradeReport | null;
  /** 고객센터 contact from 사이트 설정 (only real values). */
  contact?: { phone?: string | null; email?: string | null };
  now?: Date;
}

const link = (label: string, path: string, note?: string) =>
  `- [${label}](${absoluteUrl(path)})${note ? `: ${note}` : ''}`;

function header(): string[] {
  return [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.seo.summary}.`,
    '',
    `${josa(BRAND.name, '은', '는')} ${BRAND.regionFull} 한 곳만 다루는 지역 부동산 서비스입니다. 매물은 ${BRAND.seo.publisher}가 직접 등록하고, 아파트 실거래가는 ${DATA_SOURCES.trades.name}를 그대로 집계해 보여 줍니다.`,
  ];
}

function coverage(): string[] {
  return [
    '## 서비스 범위',
    '',
    `- 지역: ${BRAND.regionFull} (2026년 7월 1일 행정구역 개편으로 전라남도 순천시에서 변경, 시군구 코드 ${DEFAULT_SGG_CODE})`,
    '- 매물 종류: 아파트·분양권(오피스텔 포함), 원룸·투룸, 주택(단독·다가구·빌라), 상가·사무실, 토지',
    '- 거래 유형: 매매, 전세, 월세, 분양권',
    `- 매물 공개 기준: ${DATA_SOURCES.listings.note}`,
  ];
}

function sources(): string[] {
  const t = DATA_SOURCES.trades;
  return [
    '## 데이터 출처와 갱신 주기',
    '',
    `- 아파트 실거래가: ${t.name} — ${t.provider} (${t.url}). 원자료 조회: ${t.lookupName} (${t.lookupUrl}). ${t.updateCadence}.`,
    `- 매물: ${DATA_SOURCES.listings.name}. ${DATA_SOURCES.listings.updateCadence}.`,
    `- 유의: ${t.reportingNote}`,
    '- 가격 단위: 페이지의 금액은 만 원 단위이며 "3억 9,000"은 3억 9천만 원입니다. 매물 가격은 중개사가 제시한 호가이고 실거래가와 다릅니다.',
  ];
}

function pages(): string[] {
  return [
    '## 주요 페이지',
    '',
    link('홈', ROUTES.home, '순천 전체 매물 수, 인기 단지·지역'),
    link('순천 지역별 시세', SEO_ROUTES.regions, '읍면동·지구별 매물 수와 아파트 실거래 요약'),
    link(
      '순천 아파트 실거래가 월간 리포트',
      SEO_ROUTES.report,
      '최근 한 달 거래량, 평균·중위 거래가, 읍면동별 통계 (월별 보관 페이지 포함)',
    ),
    link('아파트·분양권 지도', ROUTES.map('apt'), '단지별 매물과 시세를 지도에서 보기'),
    link('중개사무소 찾기', ROUTES.agencies, '순천 공인중개사무소 목록'),
    link('서비스 소개', SEO_ROUTES.about, '운영 주체, 데이터 출처, 연락처'),
  ];
}

function patterns(): string[] {
  const assets = Object.values(LANDING_ASSETS)
    .map((a) => `${a.slug}(${a.noun})`)
    .join(', ');
  return [
    '## URL 패턴',
    '',
    `- ${absoluteUrl('/complex/')}{단지 ID}: 단지 정보 — 준공, 세대수, 평형, 국토교통부 실거래가, 현재 매물`,
    `- ${absoluteUrl('/listing/')}{매물 ID}: 매물 상세 — 가격, 면적, 층, 중개사무소 (호수는 공개하지 않음)`,
    `- ${absoluteUrl('/agency/')}{사무소 ID}: 공인중개사무소 — 등록번호, 대표 공인중개사, 보유 매물`,
    `- ${absoluteUrl(SEO_ROUTES.regions)}/{읍면동}/{매물 종류}: 지역별 시세 페이지. 읍면동은 법정동 이름(리는 "해룡면-신대리"처럼 읍·면과 함께), 매물 종류는 ${assets}`,
    `- ${absoluteUrl(SEO_ROUTES.report)}/{YYYYMM}: 해당 월 순천 아파트 매매 실거래 통계`,
    `- ${absoluteUrl('/map/')}{매물 종류}: 지도 검색 (검색 조건은 쿼리스트링, 대표 URL은 쿼리 없는 주소)`,
  ];
}

function citation(): string[] {
  return [
    '## 인용 안내',
    '',
    '- 수치를 인용할 때는 페이지에 적힌 기준일(집계 기간)과 출처(국토교통부 실거래가 또는 중개사 등록 매물)를 함께 적어 주세요.',
    '- 매물 수와 호가는 계속 바뀝니다. 단지·지역 페이지의 "기준" 시각을 확인해 주세요.',
    '- 이 사이트는 매물 광고와 실거래 통계를 제공할 뿐 가격 전망이나 투자 권유를 하지 않습니다.',
  ];
}

function contact(c: LlmsInput['contact']): string[] {
  const rows = [
    c?.phone ? `- 고객센터: ${c.phone}` : null,
    c?.email ? `- 이메일: ${c.email}` : null,
    `- 소개 페이지: ${absoluteUrl(SEO_ROUTES.about)}`,
  ].filter((r): r is string => r !== null);
  return ['## 연락처', '', ...rows];
}

function reportSummary(report: SeoTradeReport): string[] {
  const s = report.sale;
  const lines = [
    `## ${ymLabel(report.yearMonth)} ${report.regionName} 아파트 매매 실거래 요약`,
    '',
    `- 거래량: ${s.count.toLocaleString('ko-KR')}건${s.cancelledCount > 0 ? ` (해제 거래 ${s.cancelledCount}건 제외)` : ''}`,
    s.avgPrice !== null ? `- 평균 거래가: ${manwonText(s.avgPrice)}` : null,
    s.medianPrice !== null ? `- 중위 거래가: ${manwonText(s.medianPrice)}` : null,
    s.avgPricePerPyeong !== null
      ? `- 전용면적 3.3㎡당 평균: ${manwonText(s.avgPricePerPyeong)}`
      : null,
    `- 출처: ${DATA_SOURCES.trades.name} · 자세히: ${absoluteUrl(SEO_ROUTES.reportMonth(report.yearMonth))}`,
  ];
  const regions = report.byRegion.slice(0, 10).map((r) => {
    const parts = [`${r.sale.count}건`];
    if (r.sale.medianPrice !== null) parts.push(`중위 ${manwonText(r.sale.medianPrice)}`);
    return `  - ${r.name}: ${parts.join(', ')}`;
  });
  return [
    ...lines.filter((l): l is string => l !== null),
    ...(regions.length ? ['- 읍면동별 (거래량 순):', ...regions] : []),
  ];
}

function landingList(index: SeoRegionIndex): string[] {
  const landings = indexableLandings(index.regions);
  if (landings.length === 0) return [];
  return [
    '## 지역별 시세 페이지',
    '',
    ...landings.map(({ region, asset, counts }) => {
      const facts = [
        counts.listings ? `매물 ${counts.listings}건` : null,
        counts.complexes ? `단지 ${counts.complexes}곳` : null,
        counts.trades ? `최근 12개월 매매 실거래 ${counts.trades}건` : null,
      ].filter(Boolean);
      return link(landingTitle(region, asset), SEO_ROUTES.region(region, asset), facts.join(', '));
    }),
  ];
}

const join = (sections: string[][]) => `${sections.map((s) => s.join('\n')).join('\n\n')}\n`;

/** /llms.txt — the short map of the site. */
export function buildLlmsTxt(input: LlmsInput): string {
  return join([
    header(),
    coverage(),
    sources(),
    pages(),
    patterns(),
    citation(),
    contact(input.contact),
    [
      '## Optional',
      '',
      link('전체 요약 (llms-full.txt)', SEO_ROUTES.llmsFull, '최신 통계와 지역별 페이지 목록'),
    ],
  ]);
}

/** /llms-full.txt — the same plus the latest report figures and every indexable landing page. */
export function buildLlmsFullTxt(input: LlmsInput): string {
  const now = input.now ?? new Date();
  return join([
    header(),
    [`생성 시각: ${now.toISOString()} (수치는 이 시각 기준 API 집계)`],
    coverage(),
    sources(),
    pages(),
    patterns(),
    ...(input.report ? [reportSummary(input.report)] : []),
    ...(input.index ? [landingList(input.index)].filter((s) => s.length > 0) : []),
    citation(),
    contact(input.contact),
  ]);
}
