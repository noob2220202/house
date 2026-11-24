import { EmptyState, Icon } from '@house/ui';
import Link from 'next/link';
import { getNotices, getVideos } from '@/features/w-content/api/server';
import { LoadError } from '@/features/w-content/components/LoadError';
import { PageHead } from '@/features/w-content/components/PageHead';
import layout from '@/features/w-content/components/layout.module.css';
import { load } from '@/features/w-content/lib/safe';
import { NoticeList } from '@/features/w-content/notices/NoticeList';
import styles from '@/features/w-content/support/support.module.css';
import { VideoCard } from '@/features/w-content/videos/VideoCard';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

const REGION_SHORT = BRAND.region.replace(/시$/, '');
const DESCRIPTION = `${REGION_SHORT} 중개사가 전하는 동네 영상과 서비스 소식을 한곳에서 확인하세요.`;
const VIDEO_COUNT = 3;
const NOTICE_COUNT = 5;

export const metadata = buildMetadata({
  title: '커뮤니티',
  description: DESCRIPTION,
  path: ROUTES.community,
});

/**
 * 커뮤니티 (GNB) hub: the latest 동네TV videos and 공지사항 — the two sections the GNB item
 * already covers (config/nav.ts SECONDARY_NAV `match`). A real page instead of a redirect.
 */
export default async function CommunityPage() {
  const [videos, notices] = await Promise.all([
    load(() => getVideos(1, VIDEO_COUNT)),
    load(() => getNotices(1)),
  ]);
  const now = new Date().toISOString();

  return (
    <div className={`container ${layout.page}`}>
      <JsonLd data={breadcrumbJsonLd([{ name: '커뮤니티', path: ROUTES.community }])} />
      <PageHead
        eyebrow="동네 소식"
        title="커뮤니티"
        description={DESCRIPTION}
        crumbs={[{ label: '커뮤니티' }]}
      />

      <section className={styles.section} aria-labelledby="community-videos">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="community-videos" className="t-h3">
              {BRAND.tvName}
            </h2>
            <p className={styles.sectionDesc}>중개사가 직접 다니며 전하는 동네 이야기</p>
          </div>
          <Link href={ROUTES.videos} className={`link ${styles.more}`}>
            전체 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        {!videos.ok ? (
          <div className={layout.state}>
            <LoadError
              compact
              title="영상을 불러오지 못했어요"
              code={videos.error.requestId ?? videos.error.code}
            />
          </div>
        ) : videos.data.items.length === 0 ? (
          <div className={layout.state}>
            <EmptyState
              compact
              icon="play"
              title="아직 올라온 영상이 없어요"
              description="새 영상이 올라오면 이곳에서 바로 볼 수 있어요."
            />
          </div>
        ) : (
          <ul className={styles.videoGrid}>
            {videos.data.items.slice(0, VIDEO_COUNT).map((video) => (
              <li key={video.id}>
                <VideoCard video={video} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="community-notices">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="community-notices" className="t-h3">
              공지사항
            </h2>
            <p className={styles.sectionDesc}>서비스 소식과 운영 안내</p>
          </div>
          <Link href={ROUTES.notices} className={`link ${styles.more}`}>
            전체 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        {!notices.ok ? (
          <div className={layout.state}>
            <LoadError
              compact
              title="공지사항을 불러오지 못했어요"
              code={notices.error.requestId ?? notices.error.code}
            />
          </div>
        ) : notices.data.items.length === 0 ? (
          <div className={layout.state}>
            <EmptyState
              compact
              icon="megaphone"
              title="등록된 공지사항이 없어요"
              description="새 소식이 생기면 이곳에서 가장 먼저 알려 드릴게요."
            />
          </div>
        ) : (
          <NoticeList items={notices.data.items.slice(0, NOTICE_COUNT)} now={now} />
        )}
      </section>

      <nav className={styles.links} aria-label="더 알아보기">
        <Link href={ROUTES.faq} className={styles.linkCard}>
          <span className={styles.linkIcon} aria-hidden="true">
            <Icon name="chat" size={20} />
          </span>
          <span className={styles.linkText}>
            <b className={styles.linkTitle}>자주 묻는 질문</b>
            <span className={styles.linkDesc}>매물, 내놓기 · 구하기, 회원 가입</span>
          </span>
          <Icon name="chevron-right" size={18} className={styles.linkGo} />
        </Link>
        <Link href={ROUTES.tools} className={styles.linkCard}>
          <span className={styles.linkIcon} aria-hidden="true">
            <Icon name="calc" size={20} />
          </span>
          <span className={styles.linkText}>
            <b className={styles.linkTitle}>부동산 계산기</b>
            <span className={styles.linkDesc}>중개보수, 취득세, 대출 이자</span>
          </span>
          <Icon name="chevron-right" size={18} className={styles.linkGo} />
        </Link>
        <Link href={ROUTES.support} className={styles.linkCard}>
          <span className={styles.linkIcon} aria-hidden="true">
            <Icon name="phone" size={20} />
          </span>
          <span className={styles.linkText}>
            <b className={styles.linkTitle}>고객센터</b>
            <span className={styles.linkDesc}>전화, 카카오톡, 이메일 문의</span>
          </span>
          <Icon name="chevron-right" size={18} className={styles.linkGo} />
        </Link>
      </nav>
    </div>
  );
}
