'use client';
import {
  AGENCY_STATUS_LABEL,
  AUTH_PROVIDER_LABEL,
  DEAL_TYPE_LABEL,
  LISTING_STATUS_LABEL,
  ROLE_LABEL,
} from '@house/shared';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  LoadingRegion,
  Skeleton,
  StatusPill,
  type IconName,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatCount, formatDateShort, formatDealPrice } from '@/lib/format';
import { SEARCH_MIN_LENGTH, coreKeys, searchAdmin } from '../../api';
import {
  AGENCY_STATUS_TONE,
  LISTING_STATUS_TONE,
  USER_STATUS_LABEL,
  USER_STATUS_TONE,
  highlightParts,
  normalizeQuery,
} from '../../lib/search';
import styles from '../core.module.css';

function Hl({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}

function ResultPanel({
  id,
  title,
  total,
  shown,
  moreHref,
  children,
}: {
  id: string;
  title: string;
  total: number;
  shown: number;
  moreHref: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.panel} aria-labelledby={`${id}-t`}>
      <div className={styles.panelHd}>
        <h2 className={styles.panelT} id={`${id}-t`}>
          {title}
          <span className={styles.cnt}>{formatCount(total)}</span>
        </h2>
        {total > shown && (
          <Link className={styles.more} href={moreHref}>
            {formatCount(total)}건 모두 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        )}
      </div>
      <ul className={styles.rows}>{children}</ul>
    </section>
  );
}

function Row({
  href,
  icon,
  title,
  badge,
  meta,
  right,
}: {
  href: string;
  icon: IconName;
  title: ReactNode;
  badge?: ReactNode;
  meta: ReactNode;
  right: ReactNode;
}) {
  return (
    <li>
      <Link className={styles.row} href={href}>
        <span className={styles.rowIcon} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className={styles.rowT}>
          <span>{title}</span>
          {badge}
        </span>
        <span className={styles.rowM}>{meta}</span>
        <span className={styles.rowR}>{right}</span>
      </Link>
    </li>
  );
}

function ResultsSkeleton() {
  return (
    <LoadingRegion label="검색하는 중">
      <div className={styles.panel}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={styles.skRow}>
            <Skeleton width={36} height={36} radius={8} />
            <div className={styles.skCol}>
              <Skeleton width={`${48 - (i % 3) * 8}%`} height={14} />
              <Skeleton width={`${66 - (i % 2) * 14}%`} height={12} />
            </div>
            <Skeleton width={64} height={24} radius={999} />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

const withQuery = (path: string, q: string) => `${path}?q=${encodeURIComponent(q)}`;

export interface SearchViewProps {
  /** Query from the URL (`/search?q=`). */
  query: string;
}

/** Global back-office search: listings (매물번호 · 이름), broker offices and members. */
export function SearchView({ query }: SearchViewProps) {
  const router = useRouter();
  const q = normalizeQuery(query);
  const [draft, setDraft] = useState(q);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(q);
    setFormError(null);
  }, [q]);

  const enabled = q.length >= SEARCH_MIN_LENGTH;
  const result = useQuery({
    queryKey: coreKeys.search(q),
    queryFn: ({ signal }) => searchAdmin(q, signal),
    enabled,
    staleTime: 30_000,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = normalizeQuery(draft);
    if (next.length < SEARCH_MIN_LENGTH) {
      setFormError(`검색어를 ${SEARCH_MIN_LENGTH}자 이상 입력해 주세요.`);
      return;
    }
    setFormError(null);
    if (next === q) void result.refetch();
    else router.push(withQuery('/search', next));
  };

  const data = result.data;
  const total = data ? data.listings.total + data.agencies.total + data.users.total : 0;

  return (
    <div className={styles.page}>
      <AdminPageHeader title="통합 검색" crumb={['관리자 검색']} />
      <form className={styles.searchForm} role="search" onSubmit={submit} noValidate>
        <Input
          type="search"
          aria-label="관리자 통합 검색"
          placeholder="매물번호, 중개사, 회원 검색"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          prefix={<Icon name="search" size={18} />}
          error={formError}
          enterKeyHint="search"
          autoComplete="off"
          maxLength={80}
        />
        <Button type="submit" loading={result.isFetching && enabled}>
          검색
        </Button>
      </form>

      {!enabled ? (
        <div className={styles.state}>
          <EmptyState
            icon="search"
            title={q ? '검색어가 너무 짧아요' : '무엇을 찾으세요?'}
            description="매물번호, 단지·건물 이름, 중개사무소 상호나 대표자, 회원 닉네임·이메일로 찾을 수 있어요. 2자 이상 입력해 주세요."
          />
        </div>
      ) : result.isPending ? (
        <ResultsSkeleton />
      ) : result.isError || !data ? (
        <div className={styles.state}>
          <ErrorState
            title="검색 결과를 불러오지 못했어요"
            description={errorMessage(result.error)}
            onRetry={() => void result.refetch()}
          />
        </div>
      ) : total === 0 ? (
        <div className={styles.state}>
          <EmptyState
            icon="search"
            title={`‘${q}’에 대한 결과가 없어요`}
            description="띄어쓰기를 바꾸거나 매물번호 전체, 상호의 일부처럼 다른 검색어로 다시 찾아보세요."
          />
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className={styles.summary} role="status">
              <b>‘{q}’</b> 검색 결과 <b>{formatCount(total)}건</b>
            </p>
            <nav className={styles.jump} aria-label="결과 바로가기">
              {data.listings.total > 0 && (
                <Chip href="#search-listings">매물 {formatCount(data.listings.total)}</Chip>
              )}
              {data.agencies.total > 0 && (
                <Chip href="#search-agencies">중개사 {formatCount(data.agencies.total)}</Chip>
              )}
              {data.users.total > 0 && (
                <Chip href="#search-users">회원 {formatCount(data.users.total)}</Chip>
              )}
            </nav>
          </div>

          {data.listings.total > 0 && (
            <ResultPanel
              id="search-listings"
              title="매물"
              total={data.listings.total}
              shown={data.listings.items.length}
              moreHref={withQuery(ADMIN_ROUTES.listings, q)}
            >
              {data.listings.items.map((l) => (
                <Row
                  key={l.id}
                  href={`${ADMIN_ROUTES.listings}/${l.id}`}
                  icon="building"
                  title={<Hl text={l.title} query={q} />}
                  badge={<Badge>{DEAL_TYPE_LABEL[l.dealType]}</Badge>}
                  meta={
                    <>
                      {l.listingNo && (
                        <>
                          매물번호 <Hl text={l.listingNo} query={q} />
                          {' · '}
                        </>
                      )}
                      {formatDealPrice(l)}
                      {l.agencyName && (
                        <>
                          {' · '}
                          <Hl text={l.agencyName} query={q} />
                        </>
                      )}
                      {l.areaName && ` · ${l.areaName}`}
                    </>
                  }
                  right={
                    <StatusPill tone={LISTING_STATUS_TONE[l.status]} className={styles.pill}>
                      {LISTING_STATUS_LABEL[l.status]}
                    </StatusPill>
                  }
                />
              ))}
            </ResultPanel>
          )}

          {data.agencies.total > 0 && (
            <ResultPanel
              id="search-agencies"
              title="중개사"
              total={data.agencies.total}
              shown={data.agencies.items.length}
              moreHref={withQuery(ADMIN_ROUTES.agencies, q)}
            >
              {data.agencies.items.map((a) => (
                <Row
                  key={a.id}
                  href={`${ADMIN_ROUTES.agencies}/${a.id}`}
                  icon="store"
                  title={<Hl text={a.name} query={q} />}
                  meta={
                    <>
                      대표 <Hl text={a.representativeName} query={q} />
                      {a.registrationNumber && (
                        <>
                          {' · '}
                          <Hl text={a.registrationNumber} query={q} />
                        </>
                      )}
                      {a.areaName && ` · ${a.areaName}`} · 매물 {formatCount(a.listingCount)}건
                    </>
                  }
                  right={
                    <StatusPill tone={AGENCY_STATUS_TONE[a.status]} className={styles.pill}>
                      {AGENCY_STATUS_LABEL[a.status]}
                    </StatusPill>
                  }
                />
              ))}
            </ResultPanel>
          )}

          {data.users.total > 0 && (
            <ResultPanel
              id="search-users"
              title="회원"
              total={data.users.total}
              shown={data.users.items.length}
              moreHref={withQuery(ADMIN_ROUTES.users, q)}
            >
              {data.users.items.map((u) => (
                <Row
                  key={u.id}
                  href={`${ADMIN_ROUTES.users}/${u.id}`}
                  icon="user"
                  title={<Hl text={u.nickname} query={q} />}
                  badge={<Badge>{ROLE_LABEL[u.role]}</Badge>}
                  meta={
                    <>
                      {[u.name, u.email, u.phone]
                        .filter((v): v is string => !!v)
                        .map((v, i) => (
                          <span key={i}>
                            {i > 0 && ' · '}
                            <Hl text={v} query={q} />
                          </span>
                        ))}
                      {u.provider && ` · ${AUTH_PROVIDER_LABEL[u.provider]} 가입`}
                      {u.joinedAt && ` · ${formatDateShort(u.joinedAt)}`}
                    </>
                  }
                  right={
                    <StatusPill tone={USER_STATUS_TONE[u.status]} className={styles.pill}>
                      {USER_STATUS_LABEL[u.status]}
                    </StatusPill>
                  }
                />
              ))}
            </ResultPanel>
          )}
        </>
      )}
    </div>
  );
}
