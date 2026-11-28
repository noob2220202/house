import { AGENCY_SITE_COLORS, AgencySiteColor } from '@house/shared';
import { Icon } from '@house/ui';
import { useId } from 'react';
import styles from './Site.module.css';

const COLORS = Object.values(AgencySiteColor);

export interface ColorSwatchesProps {
  value: AgencySiteColor;
  onChange: (value: AgencySiteColor) => void;
  disabled?: boolean;
}

/**
 * 브랜드 색 — the preset palette (every colour reaches 4.5:1 against white). Native radios, so
 * arrow keys move between colours and screen readers hear the Korean colour name.
 */
export function ColorSwatches({ value, onChange, disabled }: ColorSwatchesProps) {
  const name = useId();
  return (
    <fieldset className={styles.swatches} disabled={disabled}>
      <legend className={styles.fieldLabel}>브랜드 색</legend>
      <div className={styles.swatchRow}>
        {COLORS.map((c) => {
          const palette = AGENCY_SITE_COLORS[c];
          const checked = c === value;
          return (
            <label key={c} className={styles.swatch} title={palette.label}>
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={c}
                checked={checked}
                onChange={() => onChange(c)}
              />
              <span className={styles.swatchDot} style={{ background: palette.brand }}>
                {checked && <Icon name="check" size={18} />}
              </span>
              <span className={styles.swatchLabel}>{palette.label}</span>
            </label>
          );
        })}
      </div>
      <p className={styles.help}>버튼, 메뉴, 선택한 필터 색에 쓰여요.</p>
    </fieldset>
  );
}
