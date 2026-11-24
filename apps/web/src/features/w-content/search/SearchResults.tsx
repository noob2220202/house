import { AgencyLogo, BrokerCard, ComplexRow, Icon } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { agencyTagline, fullAddress } from '@/features/w-agencies/lib/agency';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { formatCount, formatPerPyeong } from '@/lib/format';
import type { SearchAgency, SearchComplex, SearchRegion } from '../api/schemas';
import { complexMeta } from './format';
import { regionMapHref } from './targets';
import styles from './search.module.css';

export function ResultSection({
  id,
  title,
  total,
  moreHref,
  children,
}: {
  id: string;
  title: string;
  total: number;
  /** "더 보기" target when the section is truncated. */
  moreHref?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h2 id={id} className="t-h3">
          {title} <span className={styles.count}>{formatCount(total)}</span>
        </h2>
        {moreHref && (
          <Link href={moreHref} className={`link ${styles.more}`}>
            {title} 전체 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function RegionResults({ items }: { items: readonly SearchRegion[] }) {
  return (
    <ul className={styles.regionGrid}>
      {items.map((region) => (
        <li key={region.code}>
          <Link href={regionMapHref(region)} className={styles.region}>
            <span className={styles.regionIcon} aria-hidden="true">
              <Icon name="map-pin" size={20} />
            </span>
            <span className={styles.regionMain}>
              <b className={styles.regionName}>{region.name}</b>
              <span className={styles.regionFull}>
                {[BRAND.region, region.parentName].filter(Boolean).join(' ')}
              </span>
            </span>
            <span className={styles.regionGo}>
              지도에서 매물 보기
              <Icon name="arrow-right" size={16} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ComplexResults({ items }: { items: readonly SearchComplex[] }) {
  return (
    <ul className={styles.complexGrid}>
      {items.map((complex) => {
        const cover = complex.photos[0];
        const meta = [
          complexMeta(complex),
          complex.activeListingCount > 0 ? `매물 ${formatCount(complex.activeListingCount)}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={complex.id} className={styles.complexItem}>
            <ComplexRow
              href={ROUTES.complex(complex.id)}
              linkAs={Link}
              name={complex.name}
              dong={complex.emdName ?? complex.districtName ?? undefined}
              meta={meta || undefined}
              priceDeal="sale"
              priceDealLabel="매매"
              price={
                complex.avgPricePerPyeong !== null
                  ? formatPerPyeong(complex.avgPricePerPyeong)
                  : undefined
              }
              media={cover ? <Image src={cover.url} alt="" fill sizes="64px" /> : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function AgencyResults({ items }: { items: readonly SearchAgency[] }) {
  return (
    <ul className={styles.agencyGrid}>
      {items.map((agency) => (
        <li key={agency.id}>
          <BrokerCard
            name={agency.name}
            href={ROUTES.agency(agency.id)}
            linkAs={Link}
            specialty={agencyTagline(agency) ?? undefined}
            headingLevel={3}
            meta={[
              `대표 공인중개사 ${agency.representativeName}`,
              fullAddress(agency),
              `매물 ${formatCount(agency.activeListingCount)}`,
            ]}
            media={
              <AgencyLogo
                name={agency.name}
                seed={agency.id}
                size={56}
                image={
                  agency.logoUrl ? (
                    <Image src={agency.logoUrl} alt="" fill sizes="56px" />
                  ) : undefined
                }
              />
            }
            className={styles.agency}
          />
        </li>
      ))}
    </ul>
  );
}
