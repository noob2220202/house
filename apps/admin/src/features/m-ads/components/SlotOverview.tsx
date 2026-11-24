'use client';
import type { BannerSlot } from '@house/shared';
import { cx, ErrorState, Skeleton } from '@house/ui';
import Link from 'next/link';
import type { BannerSlotInfo } from '../api/schemas';
import { slotCaption, slotFill } from '../lib/slots';
import styles from './ads.module.css';
import { SlotGlyph } from './SlotGlyph';

export interface SlotOverviewProps {
  slots: readonly BannerSlotInfo[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Slot the list is filtered by. */
  selected: BannerSlot | null;
  /** Link that filters the list by the slot (or clears the filter when it is already selected). */
  hrefFor: (slot: BannerSlot | null) => string;
}

/** Slot cards: live / limit, meter, spec or remaining seats. Clicking a card filters the list. */
export function SlotOverview({
  slots,
  loading,
  error,
  onRetry,
  selected,
  hrefFor,
}: SlotOverviewProps) {
  if (error)
    return (
      <section aria-label="노출 위치별 현황" className={styles.panel}>
        <ErrorState compact title="노출 위치 현황을 불러오지 못했어요" onRetry={onRetry} />
      </section>
    );
  if (loading || !slots)
    return (
      <section aria-label="노출 위치별 현황" aria-busy="true">
        <div className={styles.slots}>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} height={143} radius={16} />
          ))}
        </div>
      </section>
    );
  return (
    <section aria-label="노출 위치별 현황">
      <ul className={styles.slots}>
        {slots.map((info) => {
          const caption = slotCaption(info);
          const on = selected === info.slot;
          const count = info.activeCount === null ? '–' : info.activeCount;
          return (
            <li key={info.slot}>
              <Link
                href={hrefFor(on ? null : info.slot)}
                scroll={false}
                className={cx(styles.slot, on && styles.slotOn)}
                aria-current={on ? 'true' : undefined}
                aria-label={`${info.label}, 노출 중 ${count}개, 최대 ${info.maxActive}개. ${caption.text}. ${on ? '필터 해제' : '이 위치만 보기'}`}
              >
                <span className={styles.slotTop}>
                  <SlotGlyph slot={info.slot} className={styles.slotGlyph} />
                  <span className={styles.slotN}>
                    {count}
                    <small>/ {info.maxActive}</small>
                  </span>
                </span>
                <span className={styles.slotName}>{info.label}</span>
                <span
                  className={cx(styles.meter, caption.warn && styles.meterWarn)}
                  aria-hidden="true"
                >
                  <i style={{ width: `${slotFill(info)}%` }} />
                </span>
                <span className={cx(styles.slotCap, caption.warn && styles.slotCapWarn)}>
                  {caption.text}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
