import { formatTimeOfDay } from '@/lib/format';
/**
 * Draft autosave for the 내놓기 / 구하기 wizards (localStorage, per signed-in user).
 * The draft holds contact details and the private 동/호, so it is keyed by user id, versioned,
 * expires after 30 days and is removed on submit.
 */
export type DraftKind = 'sell' | 'find';

export interface Draft<T> {
  v: number;
  step: number;
  values: T;
  savedAt: string;
}

export const DRAFT_VERSION = 1;

/**
 * Never restored from a draft: a consent is given in the session, against the document text shown
 * then (the version a restored tick would record may not be the one the user read).
 */
const NEVER_RESTORED: ReadonlySet<string> = new Set(['agreePrivacy', 'agreeProvide']);
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function draftKey(kind: DraftKind, userId: string): string {
  return `house:deal-draft:${kind}:${userId}`;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // blocked (private mode / policy)
  }
}

/**
 * Reads a draft and merges it over `defaults` (so fields added later get their default and
 * unknown keys are dropped). Returns null when missing, corrupt, outdated or expired.
 */
export function readDraft<T extends object>(
  key: string,
  defaults: T,
  now = Date.now(),
  store: StorageLike | null = storage(),
): Draft<T> | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft<Record<string, unknown>>> | null;
    if (
      !parsed ||
      parsed.v !== DRAFT_VERSION ||
      typeof parsed.values !== 'object' ||
      !parsed.values
    )
      return null;
    const savedAt = typeof parsed.savedAt === 'string' ? Date.parse(parsed.savedAt) : NaN;
    if (!Number.isFinite(savedAt) || now - savedAt > DRAFT_TTL_MS) {
      store.removeItem(key);
      return null;
    }
    const values = { ...defaults } as Record<string, unknown>;
    for (const k of Object.keys(defaults)) {
      if (NEVER_RESTORED.has(k)) continue;
      const incoming = parsed.values[k];
      const base = (defaults as Record<string, unknown>)[k];
      if (incoming === undefined || incoming === null) continue;
      if (Array.isArray(base) ? Array.isArray(incoming) : typeof incoming === typeof base)
        values[k] = incoming;
    }
    const step = Number.isInteger(parsed.step) && (parsed.step ?? 0) >= 0 ? (parsed.step ?? 0) : 0;
    return {
      v: DRAFT_VERSION,
      step,
      values: values as T,
      savedAt: new Date(savedAt).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Saves a draft; returns the save time, or null when storage is unavailable / full. */
export function writeDraft<T extends object>(
  key: string,
  step: number,
  values: T,
  now = new Date(),
  store: StorageLike | null = storage(),
): string | null {
  if (!store) return null;
  try {
    const draft: Draft<T> = { v: DRAFT_VERSION, step, values, savedAt: now.toISOString() };
    store.setItem(key, JSON.stringify(draft));
    return draft.savedAt;
  } catch {
    return null;
  }
}

export function clearDraft(key: string, store: StorageLike | null = storage()): void {
  try {
    store?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** "오후 3:42" in Asia/Seoul (the shared `formatTimeOfDay`). */
export const formatSavedTime = (iso: string): string => formatTimeOfDay(iso);
