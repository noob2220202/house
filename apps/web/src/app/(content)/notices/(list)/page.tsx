import { EmptyState, Pagination } from '@house/ui';
import Link from 'next/link';
import { getNotices } from '@/features/w-content/api/server';
import { LoadError } from '@/features/w-content/components/LoadError';
import { PageHead } from '@/features/w-content/components/PageHead';
import { SupportTabs } from '@/features/w-content/components/SupportTabs';
import layout from '@/features/w-content/components/layout.module.css';
import { devSwitches } from '@/features/w-content/lib/dev';
import { load } from '@/features/w-content/lib/safe';
import { NoticeList } from '@/features/w-content/notices/NoticeList';
import styles from '@/features/w-content/notices/notices.module.css';
import { ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

type SearchParams = Record<string, string | string[] | undefined>;

const DESCRIPTION = '서비스 소식과 운영 안내, 약관 변경 사항을 알려 드려요.';

function pageOf(searchParams: SearchParams): number {
  const raw = Number(typeof searchParams.page === 'string' ? searchParams.page : 1);
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const page = pageOf(await searchParams);
  return buildMetadata({
    title: page > 1 ? `공지사항 (${page}쪽)` : '공지사항',
    description: DESCRIPTION,
    path: page > 1 ? `${ROUTES.notices}?page=${page}` : ROUTES.notices,
  });
}

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = pageOf(sp);
  const dev = devSwitches(sp);
  const result = await load(() => {
    dev.failIfRequested();
    return getNotices(page, dev.query);
  });
  const hrefFor = (p: number) => (p > 1 ? `${ROUTES.notices}?page=${p}` : ROUTES.notices);

  return (
    <div className={`container ${layout.page}`}>
      <JsonLd data={breadcrumbJsonLd([{ name: '공지사항', path: ROUTES.notices }])} />
      <PageHead
        title="공지사항"
        description={DESCRIPTION}
        crumbs={[{ label: '고객지원' }, { label: '공지사항' }]}
      />
      <div className={layout.tabs}>
        <SupportTabs current="notices" />
      </div>
      <section className={layout.body} aria-label="공지사항 목록">
        {!result.ok ? (
          <div className={layout.state}>
            <LoadError
              title="공지사항을 불러오지 못했어요"
              code={result.error.requestId ?? result.error.code}
            />
          </div>
        ) : result.data.items.length === 0 ? (
          <div className={layout.state}>
            <EmptyState
              icon="megaphone"
              title="등록된 공지사항이 없어요"
              description="새 소식이 생기면 이곳에서 가장 먼저 알려 드릴게요."
            />
          </div>
        ) : (
          <>
            <p className={styles.count}>
              전체 <b className="num">{formatCount(result.data.total)}</b>건
            </p>
            <NoticeList items={result.data.items} now={new Date().toISOString()} />
            {result.data.totalPages > 1 && (
              <div className={styles.pager}>
                <Pagination
                  page={result.data.page}
                  totalPages={result.data.totalPages}
                  hrefFor={hrefFor}
                  linkAs={Link}
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
