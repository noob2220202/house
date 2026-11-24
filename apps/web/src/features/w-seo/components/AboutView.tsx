import { DEFAULT_SGG_CODE } from '@house/shared';
import { Button } from '@house/ui';
import Link from 'next/link';
import { Fragment } from 'react';
import { BRAND, josa } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format';
import { DATA_SOURCES, SEO_ROUTES } from '@/lib/seo';
import { Section, SeoHead, seoStyles as styles } from './parts';

/** Operator facts from 사이트 설정 — null when the operator has not filled the field in. */
export interface AboutNap {
  companyName: string | null;
  ceoName: string | null;
  businessNumber: string | null;
  mailOrderNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
}

export interface AboutViewProps {
  nap: AboutNap;
  /** 지역 with data and public listings (null when the API is unreachable). */
  coverage: { regions: number; listings: number } | null;
}

/** /about — 서비스 소개: who runs it, what it covers, where the data comes from, how to reach us. */
export function AboutView({ nap, coverage }: AboutViewProps) {
  const operator: [string, string | null][] = [
    ['상호', nap.companyName],
    ['대표', nap.ceoName],
    ['사업자등록번호', nap.businessNumber],
    ['통신판매업 신고', nap.mailOrderNumber],
    ['주소', nap.address],
  ];
  const contact: [string, string | null][] = [
    ['고객센터', nap.phone],
    ['이메일', nap.email],
    ['운영 시간', nap.hours],
  ];
  const filled = (rows: [string, string | null][]) =>
    rows.filter((r): r is [string, string] => r[1] !== null && r[1].trim() !== '');

  return (
    <div className={`container ${styles.page}`}>
      <SeoHead
        crumbs={[{ label: '서비스 소개' }]}
        eyebrow={BRAND.regionFull}
        title={`${BRAND.name} 서비스 소개`}
        lead={[
          `${josa(BRAND.name, '은', '는')} ${BRAND.seo.summary}입니다.`,
          `매물은 ${BRAND.seo.publisher}가 직접 올리고, 여러 사무소가 같은 매물을 함께 광고하는 공동중개 방식으로 운영합니다.`,
        ]}
        actions={
          <>
            <Button href={ROUTES.map('apt')} linkAs={Link}>
              지도에서 매물 찾기
            </Button>
            <Button href={SEO_ROUTES.regions} linkAs={Link} variant="secondary">
              순천 지역별 시세
            </Button>
          </>
        }
      />

      <Section id="what" title="무엇을 볼 수 있나요">
        <ul className={styles.bullets}>
          <li>아파트·분양권, 원룸·투룸, 주택, 상가·사무실, 토지 매물을 지도와 목록에서 검색</li>
          <li>아파트 단지별 준공·세대수·평형 정보와 국토교통부 실거래가 추이</li>
          <li>읍면동·지구별 매물 수, 호가 범위, 최근 12개월 실거래 요약</li>
          <li>매월 순천 아파트 매매 거래량과 평균·중위 거래가를 정리한 실거래 리포트</li>
          <li>집을 내놓거나 구하는 요청을 남기면 지역 중개사무소가 연락하는 내놓기·구하기</li>
        </ul>
      </Section>

      <Section id="coverage" title="서비스 지역">
        <p className={styles.prose}>
          {BRAND.regionFull}(시군구 코드 {DEFAULT_SGG_CODE}) 한 곳만 다룹니다. 2026년 7월 1일
          행정구역 개편으로 전라남도 순천시가 {BRAND.regionFull}가 되었고, 지역 코드도 새 코드로
          바뀌었습니다.
          {coverage &&
            ` 지금 매물이나 실거래 자료가 있는 읍면동·리는 ${formatCount(coverage.regions)}곳, 공개 매물은 ${formatCount(coverage.listings)}건입니다.`}
        </p>
      </Section>

      <Section id="sources" title="데이터 출처와 갱신 주기">
        <dl className={styles.dl}>
          <dt>매물</dt>
          <dd>
            {DATA_SOURCES.listings.name}. {DATA_SOURCES.listings.note}{' '}
            {DATA_SOURCES.listings.updateCadence}.
          </dd>
          <dt>아파트 실거래가</dt>
          <dd>
            {DATA_SOURCES.trades.name} ({DATA_SOURCES.trades.provider}).{' '}
            {DATA_SOURCES.trades.updateCadence}. 원자료는{' '}
            <a
              className="link"
              href={DATA_SOURCES.trades.lookupUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {DATA_SOURCES.trades.lookupName}
            </a>
            에서 확인할 수 있습니다.
          </dd>
          <dt>유의 사항</dt>
          <dd>
            {DATA_SOURCES.trades.reportingNote} 매물 가격은 중개사가 제시한 호가로 실제 거래 가격과
            다를 수 있습니다.
          </dd>
        </dl>
      </Section>

      <Section id="principles" title="매물 공개 원칙">
        <ul className={styles.bullets}>
          <li>등록 심사를 거친 공인중개사무소(중개사 회원)만 매물을 올릴 수 있습니다.</li>
          <li>광고 중·계약 중인 매물만 공개하고, 거래가 끝난 매물은 내립니다.</li>
          <li>호수와 소유자 연락처는 공개하지 않습니다.</li>
          <li>
            사실과 다른 매물은{' '}
            <Link className="link" href={ROUTES.report}>
              허위매물 신고
            </Link>
            로 알려 주세요.
          </li>
        </ul>
      </Section>

      <Section id="operator" title="운영자 정보">
        {filled(operator).length > 0 ? (
          <dl className={styles.dl}>
            {filled(operator).map(([k, v]) => (
              <Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <p className={styles.prose}>운영자 정보는 준비 중이에요.</p>
        )}
      </Section>

      <Section
        id="contact"
        title="문의"
        action={
          <Button href={ROUTES.support} linkAs={Link} variant="secondary" size="sm">
            고객센터
          </Button>
        }
      >
        {filled(contact).length > 0 ? (
          <dl className={styles.dl}>
            {filled(contact).map(([k, v]) => (
              <Fragment key={k}>
                <dt>{k}</dt>
                <dd>
                  {k === '고객센터' ? (
                    <a className="link" href={`tel:${v.replace(/[^0-9+]/g, '')}`}>
                      {v}
                    </a>
                  ) : k === '이메일' ? (
                    <a className="link" href={`mailto:${v}`}>
                      {v}
                    </a>
                  ) : (
                    v
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <p className={styles.prose}>고객센터 페이지에서 문의해 주세요.</p>
        )}
        <p className={styles.secSub}>
          검색엔진·AI 서비스용 요약:{' '}
          <a className="link" href={SEO_ROUTES.llms}>
            llms.txt
          </a>
        </p>
      </Section>
    </div>
  );
}
