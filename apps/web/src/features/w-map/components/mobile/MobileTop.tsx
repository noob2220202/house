'use client';
import { Button, Drawer, Icon, Popover, SegmentedControl, Switch } from '@house/ui';
import { useState } from 'react';
import type { AreaUnit } from '@/lib/format';
import { defaultFilters } from '@/lib/map';
import type { SuggestItem } from '../../api/schemas';
import { FILTER_SPEC, assetKeys, countActive, pickKeys, type MapFilters } from '../../lib/filters';
import { FilterControl, type FilterControlsProps } from '../filters/FilterBar';
import { FilterSection } from '../filters/sections';
import { SearchBox } from '../shared';
import s from './mobile.module.css';

const DEFAULTS = defaultFilters(FILTER_SPEC);

export interface MobileTopProps extends FilterControlsProps {
  onPick: (item: SuggestItem) => void;
  /** See `SearchBox.resetSignal`. */
  searchResetSignal?: number;
  onOpenFilters: () => void;
}

/** Floating search bar (category + query) and the horizontal filter chip row (MobileMap design). */
export function MobileTop({ onPick, searchResetSignal, onOpenFilters, ...props }: MobileTopProps) {
  const { asset, filters, unit, onChange, categoryHref } = props;
  const active = countActive(asset, filters);
  const thisYear = new Date().getFullYear();
  return (
    <div className={s.top}>
      <div className={s.search}>
        <Popover
          label="매물 종류"
          width={260}
          trigger={(p) => (
            <button
              type="button"
              className={s.cat}
              {...p}
              aria-label={`매물 종류: ${asset.label}, 변경`}
            >
              {asset.shortLabel}
              <Icon name="chevron-down" size={16} />
            </button>
          )}
        >
          <FilterSection
            kind="category"
            asset={asset}
            value={filters}
            onChange={onChange}
            unit={unit}
            thisYear={thisYear}
            categoryHref={categoryHref}
          />
        </Popover>
        <span className={s.searchSep} aria-hidden="true" />
        <SearchBox
          className={s.searchField}
          label={asset.searchLabel}
          placeholder={asset.listMode === 'complex' ? '지역 또는 단지명 검색' : '동네 이름 검색'}
          types={asset.listMode === 'complex' ? ['REGION', 'COMPLEX'] : ['REGION']}
          onPick={onPick}
          resetSignal={searchResetSignal}
        />
      </div>
      <div className={s.chips} role="group" aria-label="매물 필터">
        <button
          type="button"
          className={s.fbtn}
          onClick={onOpenFilters}
          aria-label={active > 0 ? `전체 필터, ${active}개 적용됨` : '전체 필터'}
        >
          <Icon name="filter" size={18} />
          필터
          {active > 0 && <span className={s.fbtnN}>{active}</span>}
        </button>
        {asset.chips.map((kind) => (
          <FilterControl key={kind} kind={kind} {...props} />
        ))}
      </div>
    </div>
  );
}

export interface MobileFilterSheetProps extends Omit<FilterControlsProps, 'onChange'> {
  open: boolean;
  onClose: () => void;
  onApply: (next: Partial<MapFilters>) => void;
  onUnitChange: (unit: AreaUnit) => void;
}

/** Full filter sheet behind the "필터" button: every section of the asset type, applied at once. */
export function MobileFilterSheet({
  open,
  onClose,
  onApply,
  onUnitChange,
  asset,
  filters,
  unit,
  categoryHref,
}: MobileFilterSheetProps) {
  const [draft, setDraft] = useState(filters);
  // Re-seed the draft each time the sheet opens (state adjusted during render, no effect needed).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(filters);
  }
  const patch = (p: Partial<MapFilters>) => setDraft((d) => ({ ...d, ...p }));
  const keys = assetKeys(asset);
  const thisYear = new Date().getFullYear();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="bottom"
      title="필터"
      footer={
        <div className={s.filterFoot}>
          <Button
            variant="ghost"
            iconLeft={<Icon name="refresh" size={18} />}
            onClick={() => patch(pickKeys(DEFAULTS, keys))}
          >
            초기화
          </Button>
          <Button
            block
            onClick={() => {
              onApply(pickKeys(draft, keys));
              onClose();
            }}
          >
            {countActive(asset, draft) > 0 ? `필터 ${countActive(asset, draft)}개 적용` : '적용'}
          </Button>
        </div>
      }
    >
      <div className={s.filterBody}>
        <div className={s.filterRow}>
          <Switch
            checked={draft.verifiedOnly}
            onChange={(e) => patch({ verifiedOnly: e.target.checked })}
          >
            실매물 확인 매물만
          </Switch>
          <SegmentedControl
            label="면적 단위"
            size="sm"
            value={unit}
            onChange={onUnitChange}
            options={[
              { value: 'pyeong', label: '평' },
              { value: 'sqm', label: '㎡' },
            ]}
          />
        </div>
        {asset.sheet.map((kind) => (
          <FilterSection
            key={kind}
            kind={kind}
            titled
            asset={asset}
            value={draft}
            onChange={patch}
            unit={unit}
            thisYear={thisYear}
            categoryHref={categoryHref}
          />
        ))}
      </div>
    </Drawer>
  );
}
