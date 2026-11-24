'use client';
import { ASSET_TYPE_LABEL, AssetType } from '@house/shared';
import { Chip, Icon } from '@house/ui';
import styles from './ui.module.css';

const ORDER: readonly AssetType[] = [
  AssetType.APT,
  AssetType.OFFICETEL,
  AssetType.ONEROOM,
  AssetType.HOUSE,
  AssetType.COMMERCIAL,
  AssetType.LAND,
];

export interface SpecialtyPickerProps {
  value: readonly AssetType[];
  onChange: (next: AssetType[]) => void;
  /** Accessible group name. */
  label?: string;
  disabled?: boolean;
}

/** Multi-select chips for the agency's 전문 분야 (asset types). */
export function SpecialtyPicker({
  value,
  onChange,
  label = '전문 분야',
  disabled,
}: SpecialtyPickerProps) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {ORDER.map((type) => {
        const selected = value.includes(type);
        return (
          <Chip
            key={type}
            selected={selected}
            disabled={disabled}
            iconLeft={selected ? <Icon name="check" size={14} strokeWidth={2.5} /> : undefined}
            onClick={() => onChange(selected ? value.filter((v) => v !== type) : [...value, type])}
          >
            {ASSET_TYPE_LABEL[type]}
          </Chip>
        );
      })}
    </div>
  );
}
