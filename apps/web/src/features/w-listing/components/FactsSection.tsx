'use client';
import { LISTING_OPTION_LABEL } from '@house/shared';
import { Icon, SegmentedControl, cx } from '@house/ui';
import Link from 'next/link';
import { useState } from 'react';
import { ROUTES } from '@/config/nav';
import { formatDateShort, type AreaUnit } from '@/lib/format';
import type { ListingDetail } from '../api/schemas';
import { buildDisclosure, buildFacts, buildVerifySteps } from '../lib/view';
import { Glyph } from './icons';
import styles from './page.module.css';

const UNIT_OPTIONS = [
  { value: 'sqm', label: '㎡' },
  { value: 'pyeong', label: '평' },
] as const;

/** 매물 정보: headline facts (㎡ ↔ 평), 실매물 확인, and the full 표시·광고 명시사항 list. */
export function FactsSection({
  listing,
  renderedAt,
}: {
  listing: ListingDetail;
  /**
   * Server render time (ms): keeps the time-dependent rows identical on hydration. Client-only
   * callers (the broker console preview) may leave it out.
   */
  renderedAt?: number;
}) {
  const [unit, setUnit] = useState<AreaUnit>('sqm');
  const facts = buildFacts(listing, unit);
  const steps = buildVerifySteps(listing);
  const disclosure = buildDisclosure(listing, renderedAt);
  const primary = listing.agencies.find((a) => a.isPrimary) ?? listing.agencies[0];
  const options = listing.options;

  return (
    <section className={styles.sec} aria-labelledby="s-facts">
      <div className={styles.secHd}>
        <h2 className={styles.secT} id="s-facts">
          매물 정보
        </h2>
        <SegmentedControl
          label="면적 단위"
          options={UNIT_OPTIONS}
          value={unit}
          onChange={setUnit}
          size="sm"
        />
      </div>

      <dl className={styles.facts}>
        {facts.map((f) => (
          <div key={f.key} className={styles.fact}>
            <dt>
              <Icon name={f.icon} size={16} />
              {f.compact ? (
                <>
                  <span className="only-lg">{f.label}</span>
                  <span className="only-sm">{f.compact.label}</span>
                </>
              ) : (
                f.label
              )}
            </dt>
            <dd>
              <b>
                {f.valueTail ? (
                  // Two halves that each stay whole: a narrow cell wraps between them, never
                  // between a number and its unit ("84.98" / "㎡"). Mobile shows the first half
                  // only and moves the second into the sub line.
                  <>
                    <span className={styles.nw}>{f.value}</span>
                    <span className={f.compact ? 'only-lg' : undefined}>
                      {' '}
                      <span className={styles.nw}>{f.valueTail}</span>
                    </span>
                  </>
                ) : (
                  f.value
                )}
              </b>
              {f.compact ? (
                <>
                  {f.sub && <span className="only-lg">{f.sub}</span>}
                  <span className="only-sm">{f.compact.sub}</span>
                </>
              ) : (
                f.sub && <span>{f.sub}</span>
              )}
            </dd>
          </div>
        ))}
        {Array.from({ length: (4 - (facts.length % 4)) % 4 }, (_, i) => (
          <div key={`f4-${i}`} className={cx(styles.fact, styles.fill4)} aria-hidden="true" />
        ))}
        {Array.from({ length: (3 - (facts.length % 3)) % 3 }, (_, i) => (
          <div key={`f3-${i}`} className={cx(styles.fact, styles.fill3)} aria-hidden="true" />
        ))}
      </dl>

      {options.length > 0 && (
        <ul className={cx(styles.optChips, 'only-sm')} aria-label={`옵션 ${options.length}개`}>
          {options.slice(0, 3).map((o) => (
            <li key={o}>{LISTING_OPTION_LABEL[o]}</li>
          ))}
          <li className={styles.optChipsMore}>
            <a href="#s-opt">
              옵션 {options.length}개
              <Icon name="chevron-right" size={16} />
            </a>
          </li>
        </ul>
      )}

      {listing.verifiedAt ? (
        <div className={styles.verify} role="group" aria-labelledby="s-verify">
          <div className={styles.verifyHd}>
            <span className={styles.verifyIc}>
              <Glyph name="shield-check" size={24} />
            </span>
            <div className={styles.verifyT}>
              <h3 id="s-verify">
                실매물 확인 완료 <span className="num">{formatDateShort(listing.verifiedAt)}</span>
              </h3>
              <p>
                {primary ? `${primary.name}` : '중개사무소'}
                <span className="only-lg">
                  가{' '}
                  {steps.length > 1
                    ? `${steps.length}단계 확인을 모두 마쳤어요`
                    : '직접 확인했어요'}
                </span>
                <span className="only-sm">
                  {' '}
                  · {steps.length > 1 ? `${steps.length}단계 확인` : '확인 완료'}
                </span>
              </p>
            </div>
            <Link className={styles.verifyMore} href={ROUTES.terms('false-listing')}>
              <span className="only-lg">확인 기준 보기</span>
              <span className="only-sm" aria-hidden="true">
                기준
              </span>
              <Icon name="chevron-right" size={16} className="only-sm" />
            </Link>
          </div>
          {steps.length > 0 && (
            <ol className={styles.verifySteps}>
              {steps.map((s, i) => (
                <li key={`${s.method}-${i}`}>
                  <Icon name="check" size={18} />
                  <div>
                    <b>
                      <span className="only-lg">{s.title}</span>
                      <span className="only-sm">{s.shortTitle}</span>
                    </b>
                    {s.sub && <span className="only-lg">{s.sub}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <p className={styles.unverified}>
          <Icon name="info" size={18} />
          아직 실매물 확인 전이에요. 방문 전에 중개사무소에 현재 상태를 꼭 확인해 주세요.
        </p>
      )}

      <div className={styles.disc}>
        <div className={styles.discHd}>
          <h3 id="s-disc">중개대상물 표시·광고 명시사항</h3>
          <span>공인중개사법 제18조의2</span>
        </div>
        <dl className={styles.discList} aria-labelledby="s-disc">
          {disclosure.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.discNote}>
          중개사무소의 명칭·소재지·연락처·등록번호·대표자 성명은 이 페이지의 공동중개 사무소 목록에
          사무소마다 표시되어 있어요.
        </p>
      </div>
    </section>
  );
}
