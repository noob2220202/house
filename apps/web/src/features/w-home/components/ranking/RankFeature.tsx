import { Button, DealCount, Icon } from '@house/ui';
import Link from 'next/link';
import { formatCount } from '@/lib/format/number';
import { RankFeatureArt } from '../../art/RankFeatureArt';
import type { RankRow } from '../../lib/ranking';
import styles from './Ranking.module.css';

/** Ink card for the #1 entry (Main.dc.html `.rank-feature`). */
export function RankFeature({ row }: { row: RankRow }) {
  const f = row.feature;
  return (
    <article className={styles.feature}>
      <RankFeatureArt className={styles.featureArt} />
      <div className={styles.featureTop}>
        <span className={styles.featureNo}>
          <span className="sr-only">순위 </span>
          {row.rank}
        </span>
        {typeof f.weeklyViews === 'number' && (
          <span className={styles.views}>
            이번 주 조회 <b>{formatCount(f.weeklyViews)}</b>회
          </span>
        )}
      </div>
      <div className={styles.featureBody}>
        {f.kicker && <p className={styles.kicker}>{f.kicker}</p>}
        <h3 className={styles.featureName}>
          <Link href={row.href}>{row.name}</Link>
        </h3>
        {f.meta && <p className={styles.featureMeta}>{f.meta}</p>}
      </div>
      <div>
        <p className={styles.priceCap}>{f.priceCaption}</p>
        <p className={`price ${styles.featurePrice}`}>{f.priceText}</p>
      </div>
      <DealCount counts={row.counts} ink className={styles.featureCounts} />
      <Button
        href={f.ctaHref}
        linkAs={Link}
        block
        className={styles.featureCta}
        iconRight={<Icon name="arrow-right" size={18} />}
      >
        {f.ctaLabel}
      </Button>
    </article>
  );
}

/** Compact #1 card for the mobile home (MobileHome `.rk1`) — the whole card is one link. */
export function RankFeatureMobile({ row }: { row: RankRow }) {
  const f = row.feature;
  return (
    <Link href={row.href} className={styles.rk1}>
      <span className={styles.rk1Top}>
        <span className={styles.rk1No}>
          <span className="sr-only">순위 </span>
          {row.rank}
        </span>
        <span className={styles.rk1Text}>
          <b className={styles.rk1Name}>{row.name}</b>
          {f.meta && <span className={styles.rk1Loc}>{f.meta}</span>}
        </span>
        <span className={styles.rk1Status}>{f.statusLabel}</span>
      </span>
      <span className={styles.rk1Bottom}>
        <span className={styles.rk1Price}>
          <em>{f.mobilePriceLabel}</em>
          <b>{f.mobilePriceText}</b>
        </span>
        <DealCount counts={row.counts} ink className={styles.rk1Counts} />
      </span>
    </Link>
  );
}
