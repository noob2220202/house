import { Badge, Button, EmptyState, Icon } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  getCurrentTerms,
  getPolicyDocument,
  getTermsVersion,
  getTermsVersions,
} from '@/features/w-content/api/server';
import type { TermsDocument, TermsVersion } from '@/features/w-content/api/schemas';
import { LoadError } from '@/features/w-content/components/LoadError';
import { PageHead } from '@/features/w-content/components/PageHead';
import { RichText, richTextHeadings } from '@/features/w-content/components/RichText';
import { SupportTabs } from '@/features/w-content/components/SupportTabs';
import layout from '@/features/w-content/components/layout.module.css';
import { devSwitches } from '@/features/w-content/lib/dev';
import { load } from '@/features/w-content/lib/safe';
import { PolicyNav } from '@/features/w-content/terms/PolicyNav';
import { VersionSelect } from '@/features/w-content/terms/VersionSelect';
import { findPolicy, policyHref, type PolicyDoc } from '@/features/w-content/terms/policies';
import styles from '@/features/w-content/terms/terms.module.css';
import { FeeScheduleTable } from '@/features/w-content/tools/FeeScheduleTable';
import { ROUTES } from '@/config/nav';
import { formatDate } from '@/lib/format';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

type Params = Promise<{ type: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type SearchParamsValue = Awaited<SearchParams>;

const SECTION_LABEL = '약관 · 정책';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ type }, sp] = await Promise.all([params, searchParams]);
  const policy = findPolicy(type);
  if (!policy) return buildMetadata({ title: SECTION_LABEL, path: '/terms', noindex: true });
  return buildMetadata({
    title: policy.label,
    description: policy.description,
    path: policyHref(policy.slug),
    // Superseded versions stay reachable but out of the index (the canonical is the current one).
    noindex: typeof sp.version === 'string',
  });
}

/**
 * /terms/[type]. The (content) group has no loading boundary above this page, so an unknown slug
 * answers a real 404 and an unknown `?version` a real 307 to the current document.
 */
export default async function TermsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ type }, sp] = await Promise.all([params, searchParams]);
  const policy = findPolicy(type);
  if (!policy) notFound();

  return (
    <div className={`container ${layout.page}`}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SECTION_LABEL, path: ROUTES.terms('service') },
          { name: policy.label, path: policyHref(policy.slug) },
        ])}
      />
      <PageHead
        eyebrow={SECTION_LABEL}
        title={policy.label}
        description={policy.description}
        crumbs={[
          { label: '고객지원', href: ROUTES.support },
          { label: SECTION_LABEL },
          { label: policy.label },
        ]}
      />
      <div className={layout.tabs}>
        <SupportTabs current="terms" />
      </div>
      <div className={styles.layout}>
        <PolicyNav current={policy.slug} />
        <article className={styles.doc} aria-label={policy.label}>
          {policy.kind === 'terms' ? (
            <TermsDocumentView policy={policy} searchParams={sp} />
          ) : policy.kind === 'policy' ? (
            <OperatorPolicy policy={policy} searchParams={sp} />
          ) : (
            <BrokerageFeePolicy />
          )}
        </article>
      </div>
    </div>
  );
}

// ---- versioned terms documents (API) -----------------------------------------------------------------

async function TermsDocumentView({
  policy,
  searchParams,
}: {
  policy: Extract<PolicyDoc, { kind: 'terms' }>;
  searchParams: SearchParamsValue;
}) {
  const dev = devSwitches(searchParams);
  const requested = typeof searchParams.version === 'string' ? searchParams.version : null;
  const basePath = policyHref(policy.slug);

  const [currentResult, versionsResult] = await Promise.all([
    load(() => {
      dev.failIfRequested();
      return getCurrentTerms(policy.type);
    }),
    load(() => getTermsVersions(policy.type)),
  ]);

  if (!currentResult.ok) {
    if (currentResult.error.isNotFound || dev.query._empty !== undefined) {
      return <NotPublished label={policy.label} />;
    }
    return (
      <div className={layout.state}>
        <LoadError
          title={`${policy.label}을 불러오지 못했어요`}
          code={currentResult.error.requestId ?? currentResult.error.code}
        />
      </div>
    );
  }
  if (dev.query._empty !== undefined) return <NotPublished label={policy.label} />;

  const current = currentResult.data;
  // The version list is an assumed endpoint: without it the page still shows the current document.
  const versions: TermsVersion[] =
    versionsResult.ok && versionsResult.data.length > 0 ? versionsResult.data : [current];

  let doc: TermsDocument = current;
  if (requested !== null && requested !== current.version) {
    const older = await load(() => getTermsVersion(policy.type, requested));
    if (!older.ok) {
      // An unknown / malformed version is a stale or hand-edited link: show the current document.
      if (older.error.isNotFound || older.error.status === 400) redirect(basePath);
      throw older.error;
    }
    doc = older.data;
  }
  const isCurrent = doc.version === current.version;
  const headings = richTextHeadings(doc.content, 'terms');

  return (
    <>
      <header className={styles.docHead}>
        <p className={styles.docMeta}>
          <span>
            버전 <b className="num">v{doc.version}</b>
          </span>
          <span>
            시행일{' '}
            <b>
              <time dateTime={doc.effectiveAt} className="num">
                {formatDate(doc.effectiveAt)}
              </time>
            </b>
          </span>
          {isCurrent ? <Badge tone="success">현재 적용 중</Badge> : <Badge>이전 버전</Badge>}
          {doc.isRequired === false && <Badge tone="brand">선택 동의</Badge>}
        </p>
        {versions.length > 1 && (
          <div className={styles.version}>
            <VersionSelect
              basePath={basePath}
              versions={versions}
              value={doc.version}
              currentVersion={current.version}
            />
          </div>
        )}
      </header>

      {!isCurrent && (
        <p className={styles.old} role="note">
          <span>
            <Icon name="info" size={18} />
            지금 보고 있는 문서는 이전 버전이에요.
          </span>
          <Link href={basePath} scroll={false}>
            현재 적용 중인 v{current.version} 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        </p>
      )}

      {headings.length >= 4 && (
        <details className={styles.toc}>
          <summary>목차</summary>
          <ol className={styles.tocList}>
            {headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className={styles.body}>
        <RichText source={doc.content} idPrefix="terms" />
      </div>
      <p className={styles.foot}>
        <span>
          {policy.label} v{doc.version} · {formatDate(doc.effectiveAt)} 시행
        </span>
        <Link className="link" href={ROUTES.notices}>
          약관 변경 공지 보기
        </Link>
      </p>
    </>
  );
}

function NotPublished({ label }: { label: string }) {
  return (
    <div className={layout.state}>
      <EmptyState
        icon="document"
        title={`${label}을 준비하고 있어요`}
        description="문서가 등록되면 이곳에서 볼 수 있어요."
      />
    </div>
  );
}

// ---- operator policies (API, ASSUMED GET /policies/:slug) ---------------------------------------

async function OperatorPolicy({
  policy,
  searchParams,
}: {
  policy: Extract<PolicyDoc, { kind: 'policy' }>;
  searchParams: SearchParamsValue;
}) {
  const dev = devSwitches(searchParams);
  const result = await load(() => {
    dev.failIfRequested();
    return getPolicyDocument(policy.slug, dev.query);
  });

  let body: ReactNode;
  if (!result.ok) {
    body = result.error.isNotFound ? (
      <NotPublished label={policy.label} />
    ) : (
      <div className={layout.state}>
        <LoadError
          title={`${policy.label}을 불러오지 못했어요`}
          code={result.error.requestId ?? result.error.code}
        />
      </div>
    );
  } else {
    const doc = result.data;
    body = (
      <>
        {(doc.version || doc.effectiveAt) && (
          <header className={styles.docHead}>
            <p className={styles.docMeta}>
              {doc.version && (
                <span>
                  버전 <b className="num">v{doc.version}</b>
                </span>
              )}
              {doc.effectiveAt && (
                <span>
                  시행일{' '}
                  <b>
                    <time dateTime={doc.effectiveAt} className="num">
                      {formatDate(doc.effectiveAt)}
                    </time>
                  </b>
                </span>
              )}
            </p>
          </header>
        )}
        <div className={styles.body}>
          <RichText source={doc.content} idPrefix="policy" />
        </div>
      </>
    );
  }

  return (
    <>
      {body}
      <aside className={styles.cta}>
        <div>
          <p className={styles.ctaTitle}>사실과 다른 매물을 발견했나요?</p>
          <p className={styles.ctaDesc}>
            매물 화면의 &lsquo;허위매물 신고&rsquo;로 알려 주세요. 처리 결과는 알림으로 알려 드려요.
          </p>
        </div>
        <Button
          href={`${ROUTES.support}#report`}
          linkAs={Link}
          iconLeft={<Icon name="siren" size={18} />}
        >
          신고 방법 보기
        </Button>
      </aside>
    </>
  );
}

// ---- static: 중개보수 안내 (statutory table) ------------------------------------------------------

function BrokerageFeePolicy() {
  return (
    <>
      <div className={styles.body}>
        <p className={styles.lead}>
          중개보수는 거래가 성사됐을 때 중개사무소에 내는 수수료예요. 법으로 정한 상한요율 안에서
          중개사무소와 협의해 정하고, 매도인(임대인)과 매수인(임차인)이 각각 냅니다.
        </p>
        <h2 className={styles.sub}>상한요율표</h2>
        <FeeScheduleTable />
        <h2 className={styles.sub}>알아 두세요</h2>
        <RichText
          idPrefix="fee"
          headingLevel={3}
          source={[
            '- 표의 요율은 상한이에요. 계약 전에 중개사무소와 실제 요율을 정하고 계약서에 적어 두세요.',
            '- 한도액이 있는 구간은 계산한 금액이 한도액을 넘어도 한도액까지만 냅니다.',
            '- 분양권은 지금까지 낸 금액(계약금, 중도금)에 프리미엄을 더한 금액이 거래금액이에요.',
            '- 일반과세 사업자인 중개사무소는 중개보수에 부가가치세 10%가 따로 붙습니다.',
            '- 중개사무소는 중개보수 요율표를 사무소 안 잘 보이는 곳에 걸어 두어야 합니다.',
          ].join('\n')}
        />
      </div>
      <aside className={styles.cta}>
        <div>
          <p className={styles.ctaTitle}>내 거래의 중개보수가 궁금한가요?</p>
          <p className={styles.ctaDesc}>거래 유형과 금액만 넣으면 바로 계산해 드려요.</p>
        </div>
        <Button
          href={`${ROUTES.tools}#fee`}
          linkAs={Link}
          iconLeft={<Icon name="calc" size={18} />}
        >
          중개보수 계산하기
        </Button>
      </aside>
    </>
  );
}
