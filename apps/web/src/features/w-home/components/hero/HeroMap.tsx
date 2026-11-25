import { BrokersBadge, Button, DealBadge, Icon, VerifiedBadge } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { formatCount } from '@/lib/format/number';
import type { HomeSummary, ListingItem } from '../../api/schemas';
import { HeroMapArt } from '../../art/HeroMapArt';
import { heroCandidates, staticHeroLayout } from '../../lib/hero-map';
import { mapHref } from '../../lib/links';
import { toListingCard } from '../../lib/listing-card';
import { HeroMapLayer } from './HeroMapLayer';
import styles from './HeroMap.module.css';

export interface HeroMapProps {
  summary: HomeSummary | undefined;
  featured: ListingItem | undefined;
}

/**
 * District map of the hero (design `.hmap`): listing counts per 동 as chips that open the map
 * search on that district, a summary pill and the most recently verified listing.
 * The chips are server-rendered links on an abstract background (no place names on it — the art
 * is not real geography); with a Kakao key the client swaps in a real, non-interactive Kakao map
 * with the chips at the regions' real coordinates (`HeroMapLayer`). The explorable map is /map.
 */
export function HeroMap({ summary, featured }: HeroMapProps) {
  const regions = heroCandidates(
    (summary?.regions ?? []).map(
      ({ code, name, emdName, lat, lng, listingCount, avgPricePerPyeong }) => ({
        code,
        name,
        emdName,
        lat,
        lng,
        listingCount,
        avgPricePerPyeong,
      }),
    ),
  );
  const card = featured ? toListingCard(featured) : undefined;
  const featuredEmdName = featured?.emdName ?? null;
  const staticLayout = staticHeroLayout(regions, { featuredEmdName, hasCard: !!card });
  // Short landmark name: every district chip inside is a link with its own count.
  const label = `${BRAND.region} 동네별 매물 지도`;

  return (
    <div className={styles.map} role="region" aria-label={label}>
      <HeroMapLayer
        regions={regions}
        featuredEmdName={featuredEmdName}
        staticLayout={staticLayout}
        art={<HeroMapArt className={styles.art} />}
      />

      <div className={styles.top} data-hero-obstacle="top">
        <p className={styles.sum}>
          {summary?.regionName ?? BRAND.region}
          {typeof summary?.listingCount === 'number' && (
            <>
              <i aria-hidden="true" />
              <span>
                매물 <b>{formatCount(summary.listingCount)}</b>
              </span>
            </>
          )}
          {typeof summary?.agencyCount === 'number' && (
            <>
              <i aria-hidden="true" className={styles.wide} />
              <span className={styles.wide}>
                중개사무소 <b>{formatCount(summary.agencyCount)}</b>
              </span>
            </>
          )}
        </p>
        <Button
          href={mapHref('apt')}
          linkAs={Link}
          pill
          className={styles.go}
          iconRight={<Icon name="arrow-right" size={18} />}
        >
          지도에서 찾기
        </Button>
      </div>

      {card && (
        <Link
          href={card.href}
          className={styles.card}
          aria-label={`${card.label} 상세 보기`}
          data-hero-obstacle="card"
        >
          <span className={styles.cardHead}>
            <DealBadge deal={card.deal} solid />
            <span className={styles.cardName}>
              {card.title}
              {card.subtitle && <span> {card.subtitle}</span>}
            </span>
          </span>
          <span className="price">{card.price}</span>
          {card.meta.length > 0 && <span className={styles.cardMeta}>{card.meta.join(' · ')}</span>}
          <span className={styles.cardFoot}>
            {card.verifiedDate ? <VerifiedBadge date={card.verifiedDate} /> : <span />}
            {card.brokerCount > 0 && <BrokersBadge count={card.brokerCount} light />}
          </span>
        </Link>
      )}
    </div>
  );
}
