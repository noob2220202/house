'use client';
import { useState } from 'react';
import type { AreaUnit } from '@/lib/format';
import type { ComplexListingItem } from '../api/schemas';
import { ListingRow } from '../panel/ListingRow';
import panel from '../panel/panel.module.css';

/**
 * The freshest listings of the complex, drawn with the same rows as the map panel. The wrapper is a
 * `cp` size container so the rows get the panel's narrow layout on phones / narrow columns.
 */
export function ListingPreview({
  listings,
  unit = 'pyeong',
}: {
  listings: readonly ComplexListingItem[];
  unit?: AreaUnit;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className={panel.host}>
      <ul className={panel.rows} aria-label="최근 확인된 매물">
        {listings.map((l) => (
          <ListingRow
            key={l.id}
            listing={l}
            unit={unit}
            open={openId === l.id}
            onToggle={() => setOpenId((id) => (id === l.id ? null : l.id))}
          />
        ))}
      </ul>
    </div>
  );
}
