import type { ReactNode } from 'react';
import styles from './ComplexRow.module.css';
import { cx } from '../lib/cx';
import { DEAL_KIND_LABEL, type DealKind, type LinkAs } from '../lib/types';
import { DealCount, type DealCounts } from './DealCount';
import { PhotoPlaceholder, type PhotoKind } from './PhotoPlaceholder';

export interface ComplexRowProps {
  href: string;
  linkAs?: LinkAs;
  name: string;
  /** 법정동, right aligned: "해룡면 신대리". */
  dong?: string;
  /** "1,412세대 · 2019년 · 25·34·41평" */
  meta?: string;
  /** Headline price: deal kind + formatted range. */
  priceDeal?: DealKind;
  priceDealLabel?: string;
  price?: string;
  counts?: DealCounts;
  /** Selected (map-synced) state. */
  selected?: boolean;
  media?: ReactNode;
  placeholder?: PhotoKind;
  className?: string;
}

/** Complex row for the map's left list (`.crow`): thumbnail + name + price range + 4-cell count. */
export function ComplexRow({
  href,
  linkAs,
  name,
  dong,
  meta,
  priceDeal,
  priceDealLabel,
  price,
  counts,
  selected,
  media,
  placeholder = 'tower',
  className,
}: ComplexRowProps) {
  const Link = linkAs ?? 'a';
  const props = {
    href,
    className: cx(styles.row, selected && styles.on, className),
    'aria-current': selected ? ('true' as const) : undefined,
  };
  return (
    <Link {...props}>
      <span className={styles.thumb}>{media ?? <PhotoPlaceholder kind={placeholder} />}</span>
      <span className={styles.main}>
        <span className={styles.top}>
          <b className={styles.name}>{name}</b>
          {dong && <span className={styles.dong}>{dong}</span>}
        </span>
        {meta && <span className={styles.meta}>{meta}</span>}
        {price && (
          <span className={styles.price}>
            {priceDeal && (
              <em className={styles[priceDeal]}>{priceDealLabel ?? DEAL_KIND_LABEL[priceDeal]}</em>
            )}
            <span className="num">{price}</span>
          </span>
        )}
        {counts && <DealCount counts={counts} />}
      </span>
    </Link>
  );
}
