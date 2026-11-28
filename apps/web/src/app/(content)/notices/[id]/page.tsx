import { Badge, Breadcrumb, Button, Icon } from '@house/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getNotice } from '@/features/w-content/api/server';
import { RichText } from '@/features/w-content/components/RichText';
import layout from '@/features/w-content/components/layout.module.css';
import { plainExcerpt } from '@/features/w-content/lib/rich-text';
import { noticeHref } from '@/features/w-content/notices/NoticeList';
import styles from '@/features/w-content/notices/notices.module.css';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { formatCount, formatDate } from '@/lib/format';
import { JsonLd, absoluteUrl, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

type Params = Promise<{ id: string }>;

/** One fetch per request for both metadata and the page; a 404 from the API becomes notFound(). */
const loadNotice = cache(async (id: string) => {
  const notice = await getNotice(id);
  if (!notice) notFound();
  return notice;
});

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const notice = await loadNotice(id);
  return buildMetadata({
    title: notice.title,
    description: plainExcerpt(notice.content, 150),
    path: noticeHref(notice.id),
    type: 'article',
  });
}

export default async function NoticeDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const notice = await loadNotice(id);
  const path = noticeHref(notice.id);

  return (
    <div className={`container ${layout.page} ${layout.narrow}`}>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: '공지사항', path: ROUTES.notices },
            { name: notice.title, path },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: notice.title,
            datePublished: notice.publishedAt ?? undefined,
            mainEntityOfPage: absoluteUrl(path),
            publisher: { '@type': 'Organization', name: BRAND.name },
          },
        ]}
      />
      <div style={{ paddingTop: 32 }}>
        <Breadcrumb
          linkAs={Link}
          items={[
            { label: '홈', href: ROUTES.home },
            { label: '공지사항', href: ROUTES.notices },
            { label: '공지 상세' },
          ]}
        />
      </div>
      <article className={styles.article} style={{ marginTop: 24 }}>
        <header className={styles.head}>
          <div className={styles.headTop}>
            {notice.isPinned ? <Badge tone="brand">중요</Badge> : <Badge>공지</Badge>}
          </div>
          <h1 className={styles.h1}>{notice.title}</h1>
          <p className={styles.headMeta}>
            {notice.publishedAt && (
              <time dateTime={notice.publishedAt} className="num">
                {formatDate(notice.publishedAt)}
              </time>
            )}
            {typeof notice.viewCount === 'number' && (
              <span className={styles.views}>
                <Icon name="eye" size={14} />
                조회 <span className="num">{formatCount(notice.viewCount)}</span>
              </span>
            )}
          </p>
        </header>
        <div className={styles.content}>
          <RichText source={notice.content} idPrefix="notice" />
        </div>
      </article>

      {(notice.prev !== undefined || notice.next !== undefined) && (
        <nav className={styles.nav} aria-label="이전 · 다음 공지">
          <NeighbourRow label="다음 글" icon="chevron-up" notice={notice.next ?? null} />
          <NeighbourRow label="이전 글" icon="chevron-down" notice={notice.prev ?? null} />
        </nav>
      )}
      <div className={styles.foot}>
        <Button
          href={ROUTES.notices}
          linkAs={Link}
          variant="secondary"
          iconLeft={<Icon name="list" size={18} />}
        >
          목록으로
        </Button>
      </div>
    </div>
  );
}

function NeighbourRow({
  label,
  icon,
  notice,
}: {
  label: string;
  icon: 'chevron-up' | 'chevron-down';
  notice: { id: string; title: string; publishedAt?: string | null } | null;
}) {
  const labelNode = (
    <span className={styles.navLabel}>
      <Icon name={icon} size={16} />
      {label}
    </span>
  );
  if (!notice) {
    return (
      <div className={styles.navRow}>
        {labelNode}
        <span className={styles.navNone}>{label}이 없어요</span>
      </div>
    );
  }
  return (
    <Link href={noticeHref(notice.id)} className={styles.navRow}>
      {labelNode}
      <span className={styles.navTitle}>{notice.title}</span>
      {notice.publishedAt && (
        <time dateTime={notice.publishedAt} className={`${styles.navDate} num`}>
          {formatDate(notice.publishedAt)}
        </time>
      )}
    </Link>
  );
}
