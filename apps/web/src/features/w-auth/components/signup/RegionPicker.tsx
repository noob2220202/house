'use client';
import { Chip, Icon, SearchField, SuncheonMapArt, Switch } from '@house/ui';
import { useMemo, useState } from 'react';
import {
  MAX_INTEREST_REGIONS,
  filterRegionGroups,
  regionByKey,
  toggleRegion,
} from '../../lib/regions';
import styles from './signup.module.css';

export interface RegionPickerProps {
  /** Selected region keys (max 5). */
  value: readonly string[];
  onChange: (keys: string[]) => void;
  notify: boolean;
  onNotifyChange: (notify: boolean) => void;
  disabled?: boolean;
}

/** "n / 5곳 선택" counter for the card header. */
export function RegionCount({ count }: { count: number }) {
  return (
    <span className="t-cap" aria-live="polite">
      <b className={styles.cnt}>{count}</b> / {MAX_INTEREST_REGIONS}곳 선택
    </span>
  );
}

/** 관심 지역 picker: mini map with pins, search, grouped toggle chips (max 5) and the alert switch. */
export function RegionPicker({
  value,
  onChange,
  notify,
  onNotifyChange,
  disabled,
}: RegionPickerProps) {
  const [query, setQuery] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const groups = useMemo(() => filterRegionGroups(query), [query]);
  const selected = value.flatMap((key) => regionByKey(key) ?? []);

  const toggle = (key: string) => {
    const result = toggleRegion(value, key);
    setLimitHit(result.limitReached);
    if (!result.limitReached) onChange(result.keys);
  };

  return (
    <>
      <div className={styles.miniMap} aria-hidden="true">
        <div className={styles.mapInner}>
          <SuncheonMapArt />
          <span
            className={`${styles.mapLabel} ${styles.mapLabelWater}`}
            style={{ left: '27%', top: '38%' }}
          >
            동천
          </span>
          <span className={styles.mapLabel} style={{ left: '61%', top: '29%' }}>
            조례호수공원
          </span>
          {selected.map((region) => (
            <span
              key={region.key}
              className={styles.pin}
              // Clamped so pins of regions near the map edge (승주읍, 해룡면 …) are never cut off.
              style={{ left: `clamp(40px, ${region.x}%, calc(100% - 40px))`, top: `${region.y}%` }}
            >
              {region.pin ?? region.name}
            </span>
          ))}
        </div>
        {selected.length === 0 && (
          <span className={styles.mapEmpty}>아래에서 관심 지역을 골라 보세요</span>
        )}
      </div>

      <SearchField
        variant="pill"
        className={styles.search}
        label="관심 지역 검색"
        placeholder="동·읍·면 또는 지구 이름 (예: 왕지동)"
        value={query}
        onChange={setQuery}
      />

      <div className={styles.groups}>
        {groups.length === 0 ? (
          <p className={styles.noMatch} role="status">
            ‘{query.trim()}’에 해당하는 지역이 없어요. 동·읍·면 이름으로 다시 찾아보세요.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className={styles.group} role="group" aria-label={group.label}>
              <p className={styles.groupK} aria-hidden="true">
                {group.label}
              </p>
              <div className={styles.chips}>
                {group.regions.map((region) => {
                  const on = value.includes(region.key);
                  return (
                    <Chip
                      key={region.key}
                      selected={on}
                      disabled={disabled}
                      onClick={() => toggle(region.key)}
                      iconLeft={on ? <Icon name="check" size={16} strokeWidth={2.25} /> : undefined}
                    >
                      {region.name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <p className={styles.limit} role="status">
        {limitHit
          ? `관심 지역은 ${MAX_INTEREST_REGIONS}곳까지 고를 수 있어요. 다른 지역을 빼고 다시 선택해 주세요.`
          : ''}
      </p>

      <Switch
        className={styles.switch}
        checked={notify}
        disabled={disabled}
        onChange={(e) => onNotifyChange(e.target.checked)}
      >
        선택한 지역에 새 매물이 오르면 알림 받기
      </Switch>
    </>
  );
}
