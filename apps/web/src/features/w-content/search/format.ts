import { formatBuiltYear, formatCount, sqmToPyeong } from '@/lib/format';
import type { SearchComplex } from '../api/schemas';

/**
 * 평형 summary of a complex from its area types: "25·34·41평". Uses the operator's `pyeongLabel`
 * ("34평") when present, otherwise 공급면적 (or 전용면적) ÷ 3.305785. More than `max` distinct
 * values collapse into a range.
 */
export function pyeongSummary(areaTypes: SearchComplex['areaTypes'], max = 4): string | null {
  const values = new Set<number>();
  for (const a of areaTypes) {
    const fromLabel = a.pyeongLabel ? Number.parseInt(a.pyeongLabel, 10) : NaN;
    const sqm = a.supplyArea ?? a.exclusiveArea;
    const pyeong = Number.isFinite(fromLabel)
      ? fromLabel
      : Number.isFinite(sqm) && sqm > 0
        ? Math.round(sqmToPyeong(sqm, 2))
        : NaN;
    if (Number.isFinite(pyeong) && pyeong > 0) values.add(pyeong);
  }
  if (values.size === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  // Many types → a range ("18~59평") instead of a long list.
  return sorted.length > max
    ? `${sorted[0]}~${sorted[sorted.length - 1]}평`
    : `${sorted.join('·')}평`;
}

/** "2019년 준공" or "2027년 입주 예정" (built year after the reference year). */
export function builtLabel(builtYear: number | null, now: Date = new Date()): string | null {
  return builtYear === null ? null : formatBuiltYear(builtYear, now);
}

/** Meta line of a complex hit: "1,412세대 · 2019년 준공 · 25·34·41평". */
export function complexMeta(complex: SearchComplex, now?: Date): string | undefined {
  const parts = [
    complex.households !== null ? `${formatCount(complex.households)}세대` : null,
    builtLabel(complex.builtYear, now),
    pyeongSummary(complex.areaTypes),
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
