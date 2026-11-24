'use client';
import { Button, Select, Switch } from '@house/ui';
import {
  DAY_KEYS,
  DAY_LABEL,
  TIME_OPTIONS,
  isValidDay,
  type DayHours,
  type DayKey,
} from '../lib/business-hours';
import styles from './Profile.module.css';

export type HoursDraft = Record<DayKey, DayHours | null>;

export interface BusinessHoursEditorProps {
  value: HoursDraft;
  onChange: (next: HoursDraft) => void;
  disabled?: boolean;
}

const OPTIONS = TIME_OPTIONS.map((t) => ({ value: t, label: t }));
const WEEKDAYS: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const FALLBACK: DayHours = { open: '09:00', close: '18:00' };

/** Per-day open/close editor: a switch (영업/휴무) and two half-hour selects per weekday. */
export function BusinessHoursEditor({ value, onChange, disabled }: BusinessHoursEditorProps) {
  const setDay = (day: DayKey, hours: DayHours | null) => onChange({ ...value, [day]: hours });
  const applyWeekdays = () => {
    const mon = value.mon;
    const next = { ...value };
    for (const d of WEEKDAYS) next[d] = mon ? { ...mon } : null;
    onChange(next);
  };
  return (
    <div className={styles.hours}>
      <ul className={styles.hoursList}>
        {DAY_KEYS.map((day) => {
          const hours = value[day];
          const invalid = !isValidDay(hours);
          const name = `${DAY_LABEL[day]}요일`;
          return (
            <li key={day} className={styles.hoursRow}>
              <span className={styles.dayName} aria-hidden="true">
                {DAY_LABEL[day]}
              </span>
              <Switch
                checked={!!hours}
                disabled={disabled}
                aria-label={`${name} 영업`}
                onChange={(e) => setDay(day, e.target.checked ? { ...FALLBACK } : null)}
              >
                <span className={styles.dayState}>{hours ? '영업' : '휴무'}</span>
              </Switch>
              {hours ? (
                <div className={styles.times}>
                  <Select
                    aria-label={`${name} 여는 시간`}
                    options={OPTIONS}
                    value={hours.open}
                    disabled={disabled}
                    onChange={(e) => setDay(day, { ...hours, open: e.target.value })}
                  />
                  <span aria-hidden="true">–</span>
                  <Select
                    aria-label={`${name} 닫는 시간`}
                    options={OPTIONS}
                    value={hours.close}
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => setDay(day, { ...hours, close: e.target.value })}
                  />
                </div>
              ) : (
                <span className={styles.closed}>쉬는 날</span>
              )}
              {invalid && (
                <p className={styles.hoursError} role="alert">
                  닫는 시간은 여는 시간보다 늦어야 해요.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {!disabled && (
        <Button type="button" variant="ghost" size="sm" onClick={applyWeekdays}>
          월요일 시간을 평일 전체에 적용
        </Button>
      )}
    </div>
  );
}
