import Link from 'next/link';
import type { CSSProperties } from 'react';
import { formatCount } from '@/lib/format/number';
import { formatPerPyeong } from '@/lib/format/price';
import type { HeroRegionChip } from '../../lib/hero-map';
import { mapHref } from '../../lib/links';
import styles from './HeroMap.module.css';

/** District chip of the hero map: name + listing count (+ 평당가 when highlighted) → map search. */
export function HeroChip({
  chip,
  on,
  style,
}: {
  chip: HeroRegionChip;
  on: boolean;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={mapHref('apt', { center: { lat: chip.lat, lng: chip.lng } })}
      className={`${styles.chip} ${on ? styles.on : ''} ${chip.wideOnly ? styles.wide : ''}`}
      style={style}
      aria-label={`${chip.name} 매물 ${formatCount(chip.count)}건 지도에서 보기`}
      data-region={chip.code}
    >
      {chip.name}
      <span className={styles.count}>{formatCount(chip.count)}</span>
      {on && chip.avgPricePerPyeong ? (
        <span className={styles.per}>{formatPerPyeong(chip.avgPricePerPyeong)}</span>
      ) : null}
    </Link>
  );
}
