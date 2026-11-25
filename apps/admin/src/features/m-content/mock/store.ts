import {
  COMPLEXES,
  TRADE_SYNC_RUNS,
  type MockComplex,
  type MockTradeSyncRun,
} from './fixtures-complexes';
import {
  FAQS,
  NOTICES,
  TERMS,
  VIDEOS,
  type MockFaq,
  type MockNotice,
  type MockTerms,
  type MockVideo,
} from './fixtures-content';
import {
  ADMIN_ACCOUNTS,
  AUDIT_LOGS,
  SETTINGS,
  type MockAdminAccount,
  type MockAuditLog,
  type MockSetting,
} from './fixtures-system';
import type { MockBootstrapJob } from './bootstrap';
import type { MockCtx } from './http';
import { newId, nowIso } from './ids';

/**
 * Mutable in-memory database of the m-content mock. It lives on `globalThis` so every route bundle
 * of the dev server shares one copy (Next compiles route handlers separately); it resets when the
 * server restarts.
 */
export interface MContentDb {
  notices: MockNotice[];
  faqs: MockFaq[];
  videos: MockVideo[];
  terms: MockTerms[];
  settings: Record<string, MockSetting>;
  complexes: MockComplex[];
  syncRuns: MockTradeSyncRun[];
  /** 실거래가로 단지 만들기 runs (newest first). */
  bootstrapJobs: MockBootstrapJob[];
  admins: MockAdminAccount[];
  audit: MockAuditLog[];
}

const KEY = '__houseAdminMockMContent' as const;
type GlobalWithDb = typeof globalThis & { [KEY]?: MContentDb };

const clone = <T>(value: T): T => structuredClone(value);

export function db(): MContentDb {
  const g = globalThis as GlobalWithDb;
  g[KEY] ??= {
    notices: clone(NOTICES),
    faqs: clone(FAQS),
    videos: clone(VIDEOS),
    terms: clone(TERMS),
    settings: clone(SETTINGS),
    complexes: clone(COMPLEXES),
    syncRuns: clone(TRADE_SYNC_RUNS),
    bootstrapJobs: [],
    admins: clone(ADMIN_ACCOUNTS),
    audit: clone(AUDIT_LOGS),
  };
  return g[KEY];
}

/** Appends an audit row the way the backend's `@Audit(...)` interceptor would. */
export function audit(
  ctx: MockCtx,
  req: { headers: Headers },
  entry: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    resourceLabel?: string | null;
    before?: unknown;
    after?: unknown;
  },
): void {
  db().audit.unshift({
    id: newId(),
    actorType: 'ADMIN',
    adminUserId: ctx.actor.id,
    adminName: ctx.actor.name,
    adminEmail: ctx.actor.email,
    userId: null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    resourceLabel: entry.resourceLabel ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: '127.0.0.1',
    userAgent: req.headers.get('user-agent'),
    requestId: `req_${Math.random().toString(36).slice(2, 12)}`,
    createdAt: nowIso(),
  });
}

/** Keeps only the keys of `patch` from `row` — the "before" side of an update audit entry. */
export function pickChanged<T extends object>(row: T, patch: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (JSON.stringify(row[key]) !== JSON.stringify(patch[key])) out[key] = row[key];
  }
  return out;
}

export function changedOnly<T extends object>(row: T, patch: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (JSON.stringify(row[key]) !== JSON.stringify(patch[key])) out[key] = patch[key];
  }
  return out;
}

/** Joins the display-only `complexName` onto a video row. */
export function withComplexName(row: MockVideo) {
  const complex = row.complexId ? db().complexes.find((c) => c.id === row.complexId) : undefined;
  return { ...row, complexName: complex?.name ?? null };
}

/** Terms rows as the API returns them: `isCurrent` = latest published version already in effect. */
export function termsView(row: MockTerms) {
  const now = Date.now();
  const current = db()
    .terms.filter(
      (t) => t.type === row.type && t.publishedAt && new Date(t.effectiveAt).getTime() <= now,
    )
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
  return { ...row, isCurrent: current?.id === row.id };
}

/** Shared `AdminAccountView` of a mock account (`locked` instead of the mock's `lockedUntil`). */
export function adminView(a: MockAdminAccount) {
  const { lockedUntil, ...rest } = a;
  return {
    ...rest,
    locked: !!lockedUntil && new Date(lockedUntil).getTime() > Date.now(),
    passwordChangedAt: null,
    updatedAt: a.createdAt,
  };
}
