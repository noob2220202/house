import { EmptyState, Pagination } from '@house/ui';
import Link from 'next/link';
import { getVideos } from '@/features/w-content/api/server';
import { LoadError } from '@/features/w-content/components/LoadError';
import { PageHead } from '@/features/w-content/components/PageHead';
import layout from '@/features/w-content/components/layout.module.css';
import { devSwitches } from '@/features/w-content/lib/dev';
import { load } from '@/features/w-content/lib/safe';
import { VideoGallery } from '@/features/w-content/videos/VideoGallery';
import { thumbnailOf, youtubeIdOf, youtubeWatchUrl } from '@/features/w-content/videos/video-utils';
import styles from '@/features/w-content/videos/videos.module.css';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { JsonLd, absoluteUrl, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 12;
/** '순천시' → '순천' (the design copy reads "순천 중개사가 …"). */
const REGION_SHORT = BRAND.region.replace(/시$/, '');
const DESCRIPTION = `${REGION_SHORT} 중개사가 직접 다니며 전하는 동네 이야기. 시세 점검, 개발 소식, 실거주 비교를 영상으로 만나 보세요.`;

export const metadata = buildMetadata({
  title: BRAND.tvName,
  description: DESCRIPTION,
  path: ROUTES.videos,
});

function pageOf(searchParams: SearchParams): number {
  const raw = Number(typeof searchParams.page === 'string' ? searchParams.page : 1);
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = pageOf(sp);
  const dev = devSwitches(sp);
  const result = await load(() => {
    dev.failIfRequested();
    return getVideos(page, PAGE_SIZE, dev.query);
  });
  // The w-home mock has no `_empty` switch — emulate it here (mock mode only).
  const videos = result.ok && dev.query._empty === undefined ? result.data.items : [];
  const initialId = typeof sp.v === 'string' ? sp.v : undefined;

  return (
    <div className={`container ${layout.page}`}>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: BRAND.tvName, path: ROUTES.videos }]),
          ...videos.flatMap((v) => {
            const id = youtubeIdOf(v);
            const thumbnail = thumbnailOf(v);
            if (!id || !thumbnail || !v.publishedAt) return [];
            return [
              {
                '@context': 'https://schema.org',
                '@type': 'VideoObject',
                name: v.title,
                description: v.description || v.title,
                thumbnailUrl: absoluteUrl(thumbnail),
                uploadDate: v.publishedAt,
                contentUrl: youtubeWatchUrl(id),
                embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
              },
            ];
          }),
        ]}
      />
      <PageHead
        eyebrow="동네 소식 · 영상"
        title={BRAND.tvName}
        description={`${REGION_SHORT} 중개사가 직접 다니며 전하는 동네 이야기`}
        crumbs={[{ label: '커뮤니티' }, { label: BRAND.tvName }]}
      />
      <div className={layout.body}>
        {!result.ok ? (
          <div className={layout.state}>
            <LoadError
              title="영상을 불러오지 못했어요"
              code={result.error.requestId ?? result.error.code}
            />
          </div>
        ) : videos.length === 0 ? (
          <div className={layout.state}>
            <EmptyState
              icon="play"
              title="아직 올라온 영상이 없어요"
              description="새 영상이 올라오면 이곳에서 바로 볼 수 있어요."
            />
          </div>
        ) : (
          <>
            <VideoGallery videos={videos} initialId={initialId} now={new Date().toISOString()} />
            {result.data.totalPages > 1 && (
              <div className={styles.pager}>
                <Pagination
                  page={result.data.page}
                  totalPages={result.data.totalPages}
                  hrefFor={(p) => (p > 1 ? `${ROUTES.videos}?page=${p}` : ROUTES.videos)}
                  linkAs={Link}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
