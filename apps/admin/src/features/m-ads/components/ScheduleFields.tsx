'use client';
import { Icon, Input, SegmentedControl, cx } from '@house/ui';
import { useId } from 'react';
import { applyStatusChoice, statusChoiceOf, type StatusChoice } from '../lib/banner-form';
import { endOfKstDay, isDay, startOfKstDay } from '../lib/dates';
import { scheduleHint } from '../lib/status';
import styles from './editor.module.css';
import { FormField } from './FormField';

export interface ScheduleValue {
  paused: boolean;
  startDate: string;
  endDate: string;
}

export interface DateRangeFieldProps {
  label?: string;
  startDate: string;
  endDate: string;
  onChange: (patch: { startDate?: string; endDate?: string }) => void;
  startError?: string;
  endError?: string;
}

/** 노출 기간: two native date inputs (KST calendar days, both inclusive). */
export function DateRangeField({
  label = '노출 기간',
  startDate,
  endDate,
  onChange,
  startError,
  endError,
}: DateRangeFieldProps) {
  const id = useId();
  const error = startError ?? endError;
  return (
    <FormField label={label} labelId={`${id}-l`} required error={error} errorId={`${id}-err`}>
      <div className={styles.daterange} role="group" aria-labelledby={`${id}-l`}>
        <span className={styles.inIco}>
          <Icon name="calendar" size={16} />
          <Input
            type="date"
            aria-label="시작일"
            className={cx(styles.inMd, styles.date, !!startError && styles.invalid)}
            aria-invalid={startError ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            value={startDate}
            max={isDay(endDate) ? endDate : undefined}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </span>
        <span aria-hidden="true">–</span>
        <span className={styles.inIco}>
          <Icon name="calendar" size={16} />
          <Input
            type="date"
            aria-label="종료일"
            className={cx(styles.inMd, styles.date, !!endError && styles.invalid)}
            aria-invalid={endError ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            value={endDate}
            min={isDay(startDate) ? startDate : undefined}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </span>
      </div>
    </FormField>
  );
}

const STATUS_OPTIONS: readonly { value: StatusChoice; label: string }[] = [
  { value: 'ACTIVE', label: '노출' },
  { value: 'PAUSED', label: '중지' },
  { value: 'SCHEDULED', label: '예약' },
];

export interface StatusFieldProps {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
}

/**
 * 상태: 노출 / 중지 / 예약. Status is computed from `paused` + the period, so choosing a segment
 * edits those fields (see `applyStatusChoice`); the hint says what will happen automatically.
 */
export function StatusField({ value, onChange }: StatusFieldProps) {
  const valid = isDay(value.startDate) && isDay(value.endDate);
  const hint = valid
    ? scheduleHint({
        paused: value.paused,
        startAt: startOfKstDay(value.startDate),
        endAt: endOfKstDay(value.endDate),
      })
    : '노출 기간을 먼저 정해 주세요';
  return (
    <FormField
      label="상태"
      side={
        <span className={styles.lbSide} aria-live="polite">
          <Icon name="clock" size={14} />
          {hint}
        </span>
      }
    >
      <SegmentedControl
        label="상태"
        className={styles.segFull}
        options={STATUS_OPTIONS}
        value={statusChoiceOf(value)}
        onChange={(choice) => onChange(applyStatusChoice(choice, value))}
      />
    </FormField>
  );
}
