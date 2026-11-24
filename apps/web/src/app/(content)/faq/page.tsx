import { Button, EmptyState, Icon } from '@house/ui';
import Link from 'next/link';
import { getFaqs } from '@/features/w-content/api/server';
import { LoadError } from '@/features/w-content/components/LoadError';
import { PageHead } from '@/features/w-content/components/PageHead';
import { SupportTabs } from '@/features/w-content/components/SupportTabs';
import layout from '@/features/w-content/components/layout.module.css';
import { FaqBrowser } from '@/features/w-content/faq/FaqBrowser';
import { isFaqCategory } from '@/features/w-content/faq/faq-utils';
import styles from '@/features/w-content/faq/faq.module.css';
import { devSwitches } from '@/features/w-content/lib/dev';
import { plainExcerpt } from '@/features/w-content/lib/rich-text';
import { load } from '@/features/w-content/lib/safe';
import { ROUTES } from '@/config/nav';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

type SearchParams = Record<string, string | string[] | undefined>;

const DESCRIPTION = '공동중개 매물, 내놓기·구하기, 중개사 회원 가입까지 자주 묻는 질문을 모았어요.';

export const metadata = buildMetadata({
  title: '자주 묻는 질문',
  description: DESCRIPTION,
  path: ROUTES.faq,
});

export default async function FaqPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const dev = devSwitches(sp);
  const result = await load(() => {
    dev.failIfRequested();
    return getFaqs(dev.query);
  });
  const initialCategory = isFaqCategory(sp.category) ? sp.category : 'ALL';
  const initialQuery = typeof sp.q === 'string' ? sp.q.slice(0, 50) : '';

  return (
    <div className={`container ${layout.page}`}>
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: '자주 묻는 질문', path: ROUTES.faq }]),
          ...(result.ok && result.data.length > 0
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: result.data.map((f) => ({
                    '@type': 'Question',
                    name: f.question,
                    acceptedAnswer: { '@type': 'Answer', text: plainExcerpt(f.answer, 1000) },
                  })),
                },
              ]
            : []),
        ]}
      />
      <PageHead
        title="자주 묻는 질문"
        description={DESCRIPTION}
        crumbs={[{ label: '고객지원' }, { label: '자주 묻는 질문' }]}
      />
      <div className={layout.tabs}>
        <SupportTabs current="faq" />
      </div>
      <section className={layout.body} aria-label="자주 묻는 질문 목록">
        {!result.ok ? (
          <div className={layout.state}>
            <LoadError
              title="질문 목록을 불러오지 못했어요"
              code={result.error.requestId ?? result.error.code}
            />
          </div>
        ) : result.data.length === 0 ? (
          <div className={layout.state}>
            <EmptyState
              icon="chat"
              title="등록된 질문이 아직 없어요"
              description="궁금한 점은 고객센터로 문의해 주세요."
              action={
                <Button href={ROUTES.support} linkAs={Link} variant="secondary">
                  고객센터 가기
                </Button>
              }
            />
          </div>
        ) : (
          <FaqBrowser
            faqs={result.data}
            initialCategory={initialCategory}
            initialQuery={initialQuery}
          />
        )}
      </section>
      <aside className={styles.help} aria-label="추가 문의">
        <div>
          <p className={styles.helpTitle}>원하는 답을 찾지 못했나요?</p>
          <p className={styles.helpDesc}>
            전화, 카카오톡, 이메일 중 편한 방법으로 고객센터에 물어보세요.
          </p>
        </div>
        <div className={styles.helpActions}>
          <Button href={ROUTES.support} linkAs={Link} iconLeft={<Icon name="chat" size={18} />}>
            고객센터 문의
          </Button>
          <Button href={`${ROUTES.support}#report`} linkAs={Link} variant="secondary">
            허위매물 신고
          </Button>
        </div>
      </aside>
    </div>
  );
}
