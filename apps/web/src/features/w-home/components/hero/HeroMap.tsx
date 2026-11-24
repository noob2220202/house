import { BrokersBadge, Button, DealBadge, Icon, VerifiedBadge } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { formatCount } from '@/lib/format/number';
import { formatPerPyeong } from '@/lib/format/price';
import type { HomeSummary, ListingItem } from '../../api/schemas';
import { HeroMapArt } from '../../art/HeroMapArt';
import { HERO_MAP_LABELS, HERO_MAP_STATION } from '../../config';
import { heroRegionChips, highlightedRegion } from '../../lib/hero-map';
import { mapHref } from '../../lib/links';
import { toListingCard } from '../../lib/listing-card';
import styles from './HeroMap.module.css';

const at = (x: number, y: number) => ({ left: `${x}%`, top: `${y}%` });

export interface HeroMapProps {
  summary: HomeSummary | undefined;
  featured: ListingItem | undefined;
}

/**
 * Stylized district map of the hero (design `.hmap`): listing counts per 동 as chips that open the
 * map search on that district, a summary pill and the most recently verified listing.
 * Purely server-rendered links — the real interactive map lives under /map.
 */
export function HeroMap({ summary, featured }: HeroMapProps) {
  const regions = summary?.regions ?? [];
  const chips = heroRegionChips(regions);
  const onCode = highlightedRegion(chips, regions, featured?.emdName);
  const card = featured ? toListingCard(featured) : undefined;
  // Short landmark name: every district chip inside is a link with its own count.
  const label = `${BRAND.region} 동네별 매물 지도`;

  return (
    <div className={styles.map} role="region" aria-label={label}>
      <HeroMapArt className={styles.art} />
      {HERO_MAP_LABELS.map((l) => (
        <span
          key={l.text}
          className={`${styles.label} ${l.kind === 'water' ? styles.water : styles.park} ${l.wide ? styles.wide : ''}`}
          style={at(l.x, l.y)}
          aria-hidden="true"
        >
          {l.text}
        </span>
      ))}
      <span
        className={styles.station}
        style={at(HERO_MAP_STATION.x, HERO_MAP_STATION.y)}
        aria-hidden="true"
      >
        {HERO_MAP_STATION.text}
      </span>

      {chips.map((c) => {
        const on = c.code === onCode;
        return (
          <Link
            key={c.code}
            href={mapHref('apt', { center: { lat: c.lat, lng: c.lng } })}
            className={`${styles.chip} ${on ? styles.on : ''} ${c.wideOnly ? styles.wide : ''}`}
            style={at(c.x, c.y)}
            aria-label={`${c.name} 매물 ${formatCount(c.count)}건 지도에서 보기`}
          >
            {c.name}
            <span className={styles.count}>{formatCount(c.count)}</span>
            {on && c.avgPricePerPyeong ? (
              <span className={styles.per}>{formatPerPyeong(c.avgPricePerPyeong)}</span>
            ) : null}
          </Link>
        );
      })}

      <div className={styles.top}>
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
        <Link href={card.href} className={styles.card} aria-label={`${card.label} 상세 보기`}>
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
