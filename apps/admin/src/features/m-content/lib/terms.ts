/** 약관 version helpers (pure; unit tested). */
import { addDaysKst, toKstDateString } from '@/lib/format';

export type TermsState = 'draft' | 'scheduled' | 'current' | 'past';

export interface TermsLike {
  publishedAt: string | null;
  effectiveAt: string;
  isCurrent: boolean;
}

/**
 * Lifecycle of one version: 작성 중 (never published) → 적용 예정 (published, effective date ahead)
 * → 적용 중 (the version members agree to now) → 지난 버전.
 */
export function termsState(doc: TermsLike, now: Date = new Date()): TermsState {
  if (!doc.publishedAt) return 'draft';
  if (doc.isCurrent) return 'current';
  return new Date(doc.effectiveAt).getTime() > now.getTime() ? 'scheduled' : 'past';
}

export const TERMS_STATE_LABEL: Record<TermsState, string> = {
  draft: '작성 중',
  scheduled: '적용 예정',
  current: '적용 중',
  past: '지난 버전',
};
export const TERMS_STATE_TONE = {
  draft: 'review',
  scheduled: 'scheduled',
  current: 'live',
  past: 'ended',
} as const;

const parts = (version: string): number[] =>
  version.split('.').map((p) => {
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  });

/** Numeric comparison of dotted versions ("1.10" > "1.9"). */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Suggests the next minor version after the highest existing one ("1.1" → "1.2"; none → "1.0"). */
export function nextVersion(existing: readonly string[]): string {
  const valid = existing.filter((v) => /^\d+(\.\d+){0,2}$/.test(v));
  if (valid.length === 0) return '1.0';
  const latest = [...valid].sort(compareVersions).pop() ?? '1.0';
  const [major = 1, minor = 0] = parts(latest);
  return `${major}.${minor + 1}`;
}

/** "2026-12-15" (KST calendar date) → "2026-12-15T00:00:00+09:00". */
export const kstDateToIso = (date: string): string => `${date}T00:00:00+09:00`;

/** ISO datetime → the KST calendar date "YYYY-MM-DD" (value of <input type="date">). */
export function isoToKstDate(iso: string): string {
  return toKstDateString(iso);
}

/** KST calendar date `days` after `now` — default effective date of a new version (공지 기간 7일). */
export function kstDateAfter(days: number, now: Date = new Date()): string {
  return addDaysKst(toKstDateString(now), days);
}

/** Whole days from `now` until the effective date (negative = already in effect). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const day = (t: number) => Math.floor((t + 9 * 3600_000) / 86_400_000);
  return day(new Date(iso).getTime()) - day(now.getTime());
}
