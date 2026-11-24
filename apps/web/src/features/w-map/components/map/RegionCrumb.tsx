'use client';
import { Icon, Popover, cx } from '@house/ui';
import { BRAND } from '@/config/brand';
import type { Region } from '../../api/schemas';
import s from './map.module.css';

/** "순천시" (the full 전남광주통합특별시 name is too long for the crumb chip). */
const CITY_LABEL = BRAND.region;

export interface RegionCrumbProps {
  regions: readonly Region[];
  /** Region in focus (closest 동 when zoomed in), or null at city level. */
  current: Region | null;
  onCity: () => void;
  onPick: (region: Region) => void;
  className?: string;
}

/**
 * 시 › 읍·면 › 동/지구 chip (design `.crumb` with the round pin). The last crumb opens the region
 * picker; the city crumb zooms back out to the whole city.
 */
export function RegionCrumb({ regions, current, onCity, onPick, className }: RegionCrumbProps) {
  const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return (
    <nav className={cx(s.crumb, className)} aria-label="지도 위치">
      <span className={s.crumbPin} aria-hidden="true">
        <Icon name="map-pin" size={16} />
      </span>
      <button type="button" className={cx(s.crumbB, !current && s.crumbOn)} onClick={onCity}>
        {CITY_LABEL}
      </button>
      {current?.parentName && (
        <>
          <Icon name="chevron-right" size={14} className={s.crumbSep} />
          <span className={s.crumbText}>{current.parentName}</span>
        </>
      )}
      <Icon name="chevron-right" size={14} className={s.crumbSep} />
      <Popover
        label="지역 선택"
        width={300}
        trigger={(p) => (
          <button
            type="button"
            className={cx(s.crumbB, current && s.crumbOn)}
            aria-current={current ? 'location' : undefined}
            {...p}
          >
            {current?.name ?? '동 선택'}
            <Icon name="chevron-down" size={14} />
          </button>
        )}
      >
        {(close) => (
          <div className={s.regionPicker}>
            <p className={s.regionTitle}>어느 동네를 볼까요?</p>
            {sorted.length === 0 ? (
              <p className={s.regionEmpty}>지역 목록을 불러오지 못했어요.</p>
            ) : (
              <ul className={s.regionGrid}>
                {sorted.map((r) => (
                  <li key={r.code}>
                    <button
                      type="button"
                      className={cx(s.regionBtn, r.code === current?.code && s.regionOn)}
                      aria-pressed={r.code === current?.code}
                      onClick={() => {
                        onPick(r);
                        close();
                      }}
                    >
                      {r.name}
                      {r.parentName && <small>{r.parentName}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Popover>
    </nav>
  );
}
