import { Button, Chip, EmptyState, Icon, Tabs, type IconName } from '@house/ui';
import Link from 'next/link';
import { getPopularSearches, getSearchResults } from '@/features/w-content/api/server';
import { LoadError } from '@/features/w-content/components/LoadError';
import { PageHead } from '@/features/w-content/components/PageHead';
import layout from '@/features/w-content/components/layout.module.css';
import { devSwitches } from '@/features/w-content/lib/dev';
import { load } from '@/features/w-content/lib/safe';
import {
  AgencyResults,
  ComplexResults,
  RegionResults,
  ResultSection,
} from '@/features/w-content/search/SearchResults';
import { SiteSearch } from '@/features/w-content/search/SiteSearch';
import styles from '@/features/w-content/search/search.module.css';
import {
  normalizeSearchQuery,
  parseSearchTab,
  searchHref,
  type SearchTab,
} from '@/features/w-content/search/targets';
import { ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const q = normalizeSearchQuery((await searchParams).q);
  return buildMetadata({
    title: q ? `'${q}' 검색 결과` : '통합 검색',
    description: '지역, 단지, 중개사무소를 한 번에 검색해 보세요.',
    path: '/search',
    // Search result pages are thin/duplicate content — keep them out of the index.
    noindex: true,
  });
}

const SHORTCUTS: { href: string; icon: IconName; title: string; desc: string }[] = [
  {
    href: ROUTES.map('apt'),
    icon: 'building',
    title: '아파트 · 분양권',
    desc: '지도에서 단지별로 보기',
  },
  { href: ROUTES.map('oneroom'), icon: 'room', title: '원룸 · 투룸', desc: '대학가 · 역세권 월세' },
  { href: ROUTES.agencies, icon: 'store', title: '중개사무소', desc: '지역 · 전문 분야로 찾기' },
  { href: ROUTES.deal, icon: 'swap', title: '내놓기 · 구하기', desc: '조건을 남기고 제안 받기' },
];

/** Real popular keywords only; nothing to show → no row. */
function PopularChips({ label, keywords }: { label: string; keywords: readonly string[] }) {
  if (keywords.length === 0) return null;
  return (
    <div className={styles.popular}>
      <span className={styles.popularLabel}>{label}</span>
      {keywords.map((keyword) => (
        <Chip key={keyword} variant="quick" href={ROUTES.search(keyword)} linkAs={Link}>
          {keyword}
        </Chip>
      ))}
    </div>
  );
}

function Shortcuts() {
  return (
    <ul className={styles.shortcuts}>
      {SHORTCUTS.map((s) => (
        <li key={s.href}>
          <Link href={s.href} className={styles.shortcut}>
            <span className={styles.shortcutIcon} aria-hidden="true">
              <Icon name={s.icon} size={20} />
            </span>
            <b className={styles.shortcutTitle}>{s.title}</b>
            <span className={styles.shortcutDesc}>{s.desc}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = normalizeSearchQuery(sp.q);
  const tab = parseSearchTab(sp.type);

  if (q === '') {
    const popular = await getPopularSearches();
    return (
      <div className={`container ${layout.page}`}>
        <PageHead
          title="무엇을 찾으세요?"
          description="지역, 단지 이름, 중개사무소를 한 번에 검색해 보세요."
          crumbs={[{ label: '통합 검색' }]}
        />
        <div className={styles.hero}>
          {/* The chips below already offer the popular keywords: the list opens only on typing. */}
          <SiteSearch autoFocus showPopular={false} />
          <PopularChips label="많이 찾는" keywords={popular} />
        </div>
        <h2 className={`t-h3 ${styles.sectionTitle}`}>바로 가기</h2>
        <Shortcuts />
      </div>
    );
  }

  const dev = devSwitches(sp);
  const [result, popular] = await Promise.all([
    load(() => {
      dev.failIfRequested();
      return getSearchResults(q, tab === 'all' ? undefined : tab);
    }),
    getPopularSearches(),
  ]);
  const data = result.ok ? result.data : null;
  const sections = data ? [data.regions, data.complexes, data.agencies] : [];
  const allFailed = !data || sections.every((s) => s.failed);
  const failedLabels = data
    ? (
        [
          [data.regions, '지역'],
          [data.complexes, '단지'],
          [data.agencies, '중개사무소'],
        ] as const
      )
        .filter(([s]) => s.failed)
        .map(([, label]) => label)
    : [];

  const totals = data
    ? {
        region: data.regions.total,
        complex: data.complexes.total,
        agency: data.agencies.total,
      }
    : { region: 0, complex: 0, agency: 0 };
  const totalAll = totals.region + totals.complex + totals.agency;
  const show = (section: Exclude<SearchTab, 'all'>) => tab === 'all' || tab === section;
  const more = (section: Exclude<SearchTab, 'all'>, shown: number) =>
    tab === 'all' && totals[section] > shown ? searchHref(q, section) : undefined;

  return (
    <div className={`container ${layout.page}`}>
      <PageHead
        title={
          <>
            <span style={{ color: 'var(--brand)' }}>&lsquo;{q}&rsquo;</span> 검색 결과
          </>
        }
        crumbs={[{ label: '통합 검색' }]}
      />
      <div className={styles.hero}>
        <SiteSearch initialQuery={q} />
      </div>

      {allFailed ? (
        <div className={layout.state} style={{ marginTop: 32 }}>
          <LoadError
            title="검색 결과를 불러오지 못했어요"
            code={result.ok ? undefined : (result.error.requestId ?? result.error.code)}
          />
        </div>
      ) : totalAll === 0 && failedLabels.length === 0 ? (
        <>
          <div className={layout.state} style={{ marginTop: 32 }}>
            <EmptyState
              title={`'${q}'에 맞는 결과가 없어요`}
              description="띄어쓰기를 바꾸거나 동 이름, 단지 이름의 앞 글자만 넣어 보세요. 지도에서 직접 찾아볼 수도 있어요."
              action={
                <Button
                  href={ROUTES.map('apt')}
                  linkAs={Link}
                  iconLeft={<Icon name="map-pin" size={18} />}
                >
                  지도에서 찾기
                </Button>
              }
            />
          </div>
          <PopularChips label="이런 검색어는 어때요?" keywords={popular} />
        </>
      ) : (
        <>
          <p className={styles.summary} role="status">
            지역, 단지, 중개사무소에서 <b className="num">{formatCount(totalAll)}</b>건을 찾았어요.
          </p>
          {failedLabels.length > 0 && (
            <p className={styles.partial} role="alert">
              <Icon name="info" size={16} />
              {failedLabels.join(', ')} 결과를 불러오지 못했어요. 잠시 뒤 다시 검색해 주세요.
            </p>
          )}
          <div className={styles.tabs}>
            <Tabs<SearchTab>
              label="검색 결과 분류"
              linkAs={Link}
              value={tab}
              items={[
                { value: 'all', label: '전체', count: totalAll, href: searchHref(q) },
                {
                  value: 'region',
                  label: '지역',
                  count: totals.region,
                  href: searchHref(q, 'region'),
                },
                {
                  value: 'complex',
                  label: '단지',
                  count: totals.complex,
                  href: searchHref(q, 'complex'),
                },
                {
                  value: 'agency',
                  label: '중개사무소',
                  count: totals.agency,
                  href: searchHref(q, 'agency'),
                },
              ]}
            />
          </div>

          {data && show('region') && data.regions.items.length > 0 && (
            <ResultSection
              id="search-regions"
              title="지역"
              total={totals.region}
              moreHref={more('region', data.regions.items.length)}
            >
              <RegionResults items={data.regions.items} />
            </ResultSection>
          )}
          {data && show('complex') && data.complexes.items.length > 0 && (
            <ResultSection
              id="search-complexes"
              title="단지"
              total={totals.complex}
              moreHref={more('complex', data.complexes.items.length)}
            >
              <ComplexResults items={data.complexes.items} />
            </ResultSection>
          )}
          {data && show('agency') && data.agencies.items.length > 0 && (
            <ResultSection
              id="search-agencies"
              title="중개사무소"
              total={totals.agency}
              moreHref={more('agency', data.agencies.items.length)}
            >
              <AgencyResults items={data.agencies.items} />
            </ResultSection>
          )}
          {tab !== 'all' && totals[tab] === 0 && (
            <div className={layout.state} style={{ marginTop: 32 }}>
              <EmptyState
                compact
                title="이 분류에는 결과가 없어요"
                description="전체 탭에서 다른 분류의 결과를 확인해 보세요."
                action={
                  <Button href={searchHref(q)} linkAs={Link} variant="secondary">
                    전체 결과 보기
                  </Button>
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
