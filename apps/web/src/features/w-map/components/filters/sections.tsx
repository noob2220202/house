'use client';
import {
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  DealType,
  Direction,
  FLOOR_CLASS_LABEL,
  FloorClass,
  LISTING_OPTION_LABEL,
} from '@house/shared';
import { Icon, RangeSlider, SegmentedControl, cx } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MapAssetSlug } from '@/config/nav';
import type { AreaUnit } from '@/lib/format';
import {
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  LandCategory,
  LandZone,
  ROOM_TYPE_LABEL,
  RoomType,
} from '../../api/schemas';
import { ASSETS, ASSET_SLUGS, type AssetConfig, type FilterKind } from '../../config/assets';
import {
  BUILT_PRESETS,
  KIND_LABEL,
  SCALES,
  amountLabel,
  areaToPyeong,
  areaToSqm,
  builtPresetValue,
  optionChoices,
  scaleIndex,
  scaleRange,
  toggleValue,
  type MapFilters,
} from '../../lib/filters';
import s from './filters.module.css';

export interface SectionProps {
  asset: AssetConfig;
  value: MapFilters;
  onChange: (patch: Partial<MapFilters>) => void;
  unit: AreaUnit;
  thisYear: number;
  /** Link to another asset type keeping the map view (매물종류). */
  categoryHref?: (slug: MapAssetSlug) => string;
  /** When given, the area section offers the 평 / ㎡ switch itself. */
  onUnitChange?: (unit: AreaUnit) => void;
}

// ---- building blocks ----------------------------------------------------------------------------

interface PillOption {
  value: string;
  label: string;
}

/** Multi-select pills (toggle buttons). An empty selection means "전체". */
export function PillGroup({
  label,
  options,
  selected,
  onToggle,
  columns,
}: {
  label: string;
  options: readonly PillOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  columns?: number;
}) {
  return (
    <div
      className={cx(s.pills, columns && s.pillGrid)}
      role="group"
      aria-label={label}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={cx(s.pill, on && s.pillOn)}
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Single-choice pills (radio semantics); `null` = 전체. */
function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T | null; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className={s.pills} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            className={cx(s.pill, on && s.pillOn)}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Two-thumb slider over a list of stops; the open ends are stored as null. */
function RangeBlock({
  label,
  scale,
  min,
  max,
  onChange,
  format,
}: {
  label: string;
  scale: readonly number[];
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  format: (stop: number) => string;
}) {
  const last = scale.length - 1;
  const lo = scaleIndex(scale, min, 'min');
  const hi = scaleIndex(scale, max, 'max');
  const mid = Math.round(last / 2);
  return (
    <div className={s.range}>
      <RangeSlider
        label={label}
        min={0}
        max={last}
        step={1}
        value={[lo, hi]}
        onChange={([a, b]) => onChange(...scaleRange(scale, a, b))}
        formatValue={(i) => (i <= 0 ? '0' : format(scale[i] ?? 0))}
        maxLabel="최대"
      />
      <div className={s.ticks} aria-hidden="true">
        <span>0</span>
        <span>{format(scale[mid] ?? 0)}</span>
        <span>최대</span>
      </div>
    </div>
  );
}

const pills = <T extends string>(values: readonly T[], labels: Record<T, string>): PillOption[] =>
  values.map((value) => ({ value, label: labels[value] }));

// ---- sections -----------------------------------------------------------------------------------

function CategorySection({ asset, value, onChange, categoryHref }: SectionProps) {
  return (
    <>
      <ul className={s.catList}>
        {ASSET_SLUGS.map((slug) => {
          const on = slug === asset.slug;
          return (
            <li key={slug}>
              <Link
                href={categoryHref?.(slug) ?? `/map/${slug}`}
                className={cx(s.cat, on && s.catOn)}
                aria-current={on ? 'page' : undefined}
              >
                {ASSETS[slug].label}
                {on && <Icon name="check" size={18} />}
              </Link>
            </li>
          );
        })}
      </ul>
      {asset.subTypes && (
        <div className={s.sub}>
          <p className={s.subTitle}>세부 종류</p>
          <PillGroup
            label="세부 종류"
            options={asset.subTypes}
            selected={value.assetTypes}
            onToggle={(v) => onChange({ assetTypes: toggleValue(value.assetTypes, v) })}
          />
        </div>
      )}
    </>
  );
}

function PriceSection({ asset, value, onChange }: SectionProps) {
  const deals = value.dealTypes.length ? value.dealTypes : asset.dealTypes;
  const has = (...d: DealType[]) => d.some((x) => deals.includes(x) && asset.dealTypes.includes(x));
  const { price, deposit, rent } = asset.scales;
  const blocks: ReactNode[] = [];
  if (price && has(DealType.SALE, DealType.PRESALE)) {
    blocks.push(
      <RangeBlock
        key="price"
        label={asset.dealTypes.includes(DealType.PRESALE) ? '매매가 · 분양권' : '매매가'}
        scale={SCALES[price]}
        min={value.priceMin}
        max={value.priceMax}
        format={amountLabel}
        onChange={(priceMin, priceMax) => onChange({ priceMin, priceMax })}
      />,
    );
  }
  if (deposit && has(DealType.JEONSE, DealType.MONTHLY)) {
    blocks.push(
      <RangeBlock
        key="deposit"
        label="보증금 (전세 · 월세)"
        scale={SCALES[deposit]}
        min={value.depositMin}
        max={value.depositMax}
        format={amountLabel}
        onChange={(depositMin, depositMax) => onChange({ depositMin, depositMax })}
      />,
    );
  }
  if (rent && has(DealType.MONTHLY)) {
    blocks.push(
      <RangeBlock
        key="rent"
        label="월세"
        scale={SCALES[rent]}
        min={value.rentMin}
        max={value.rentMax}
        format={amountLabel}
        onChange={(rentMin, rentMax) => onChange({ rentMin, rentMax })}
      />,
    );
  }
  return (
    <div className={s.stack}>
      {blocks}
      <p className={s.note}>금액 단위는 만원입니다. 선택한 거래방식에 해당하는 금액만 걸러요.</p>
    </div>
  );
}

function body(kind: FilterKind, p: SectionProps): ReactNode {
  const { asset, value, onChange, unit, thisYear } = p;
  switch (kind) {
    case 'category':
      return <CategorySection {...p} />;
    case 'deal':
      return (
        <PillGroup
          label="거래방식"
          options={pills(asset.dealTypes, DEAL_TYPE_LABEL)}
          selected={value.dealTypes}
          onToggle={(v) => onChange({ dealTypes: toggleValue(value.dealTypes, v) })}
        />
      );
    case 'roomType':
      return (
        <PillGroup
          label="방 종류"
          options={pills(Object.values(RoomType), ROOM_TYPE_LABEL)}
          selected={value.roomTypes}
          onToggle={(v) => onChange({ roomTypes: toggleValue(value.roomTypes, v) })}
        />
      );
    case 'area': {
      const scale = SCALES[asset.scales.area];
      return (
        <div className={s.stack}>
          {p.onUnitChange && (
            <SegmentedControl
              label="면적 단위"
              size="sm"
              value={unit}
              onChange={p.onUnitChange}
              className={s.unitSeg}
              options={[
                { value: 'pyeong', label: '평' },
                { value: 'sqm', label: '㎡' },
              ]}
            />
          )}
          <RangeBlock
            label={`${asset.areaLabel} (${unit === 'pyeong' ? '평' : '㎡'})`}
            scale={scale}
            min={areaToPyeong(value.areaMin)}
            max={areaToPyeong(value.areaMax)}
            format={(py) => (unit === 'pyeong' ? `${py}평` : `${Math.round(areaToSqm(py))}㎡`)}
            onChange={(lo, hi) =>
              onChange({
                areaMin: lo === null ? null : areaToSqm(lo),
                areaMax: hi === null ? null : areaToSqm(hi),
              })
            }
          />
        </div>
      );
    }
    case 'price':
      return <PriceSection {...p} />;
    case 'deposit':
      return (
        <RangeBlock
          label="보증금"
          scale={SCALES[asset.scales.deposit ?? 'depositRoom']}
          min={value.depositMin}
          max={value.depositMax}
          format={amountLabel}
          onChange={(depositMin, depositMax) => onChange({ depositMin, depositMax })}
        />
      );
    case 'rent':
      return (
        <RangeBlock
          label="월세"
          scale={SCALES[asset.scales.rent ?? 'rent']}
          min={value.rentMin}
          max={value.rentMax}
          format={amountLabel}
          onChange={(rentMin, rentMax) => onChange({ rentMin, rentMax })}
        />
      );
    case 'direction':
      return (
        <PillGroup
          label="방향"
          columns={4}
          options={pills(Object.values(Direction), DIRECTION_LABEL)}
          selected={value.directions}
          onToggle={(v) => onChange({ directions: toggleValue(value.directions, v) })}
        />
      );
    case 'rooms':
    case 'baths': {
      const key = kind === 'rooms' ? 'roomsMin' : 'bathsMin';
      const counts = kind === 'rooms' ? [1, 2, 3, 4] : [1, 2, 3];
      return (
        <ChoiceGroup
          label={kind === 'rooms' ? '방 개수' : '욕실 개수'}
          value={value[key]}
          onChange={(v) => onChange({ [key]: v })}
          options={[
            { value: null, label: '전체' },
            ...counts.map((n) => ({ value: n, label: `${n}개 이상` })),
          ]}
        />
      );
    }
    case 'floor':
      return (
        <PillGroup
          label="층"
          options={pills(Object.values(FloorClass), FLOOR_CLASS_LABEL)}
          selected={value.floorClasses}
          onToggle={(v) => onChange({ floorClasses: toggleValue(value.floorClasses, v) })}
        />
      );
    case 'built': {
      const current = BUILT_PRESETS.find((preset) => {
        const v = builtPresetValue(preset, thisYear);
        return v.builtYearMin === value.builtYearMin && v.builtYearMax === value.builtYearMax;
      });
      return (
        <ChoiceGroup
          label="준공 연도"
          value={current?.label ?? null}
          onChange={(label) => {
            const preset = BUILT_PRESETS.find((x) => x.label === label);
            onChange(
              preset
                ? builtPresetValue(preset, thisYear)
                : { builtYearMin: null, builtYearMax: null },
            );
          }}
          options={[
            { value: null, label: '전체' },
            ...BUILT_PRESETS.map((preset) => ({ value: preset.label, label: preset.label })),
          ]}
        />
      );
    }
    case 'options':
    case 'quickOptions':
      return (
        <PillGroup
          label="옵션"
          options={pills(optionChoices(asset), LISTING_OPTION_LABEL)}
          selected={value.options}
          onToggle={(v) => onChange({ options: toggleValue(value.options, v) })}
        />
      );
    case 'landZone':
      return (
        <PillGroup
          label="용도지역"
          options={pills(Object.values(LandZone), LAND_ZONE_LABEL)}
          selected={value.landZones}
          onToggle={(v) => onChange({ landZones: toggleValue(value.landZones, v) })}
        />
      );
    case 'landCategory':
      return (
        <PillGroup
          label="지목"
          options={pills(Object.values(LandCategory), LAND_CATEGORY_LABEL)}
          selected={value.landCategories}
          onToggle={(v) => onChange({ landCategories: toggleValue(value.landCategories, v) })}
        />
      );
    case 'more':
      return null;
  }
}

/** One filter section. `titled` adds a heading (추가 필터 popover, mobile filter sheet). */
export function FilterSection({
  kind,
  titled,
  ...props
}: SectionProps & { kind: FilterKind; titled?: boolean }) {
  const content = body(kind, props);
  if (!titled) return <>{content}</>;
  const title =
    kind === 'area' ? props.asset.areaLabel : kind === 'rooms' ? '방 개수' : KIND_LABEL[kind];
  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>{title}</h3>
      {content}
    </section>
  );
}
