export type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffRow {
  /** Dot path of the field, e.g. "address.road" (arrays are compared as whole values). */
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

type Flat = Map<string, unknown>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function flatten(value: unknown, prefix: string, out: Flat): void {
  if (isPlainObject(value) && Object.keys(value).length > 0) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, value);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Field-level diff of two audit snapshots (`before` / `after` JSON). Either side may be null
 * (create → everything "added", delete → everything "removed"). Rows keep the order of `after`,
 * followed by fields that only exist in `before`. Unchanged fields are included only on request.
 */
export function diffJson(
  before: unknown,
  after: unknown,
  options: { includeUnchanged?: boolean } = {},
): DiffRow[] {
  const a: Flat = new Map();
  const b: Flat = new Map();
  if (before !== null && before !== undefined) flatten(before, '', a);
  if (after !== null && after !== undefined) flatten(after, '', b);

  const rows: DiffRow[] = [];
  for (const [path, value] of b) {
    if (!a.has(path)) rows.push({ path, kind: 'added', after: value });
    else if (!same(a.get(path), value))
      rows.push({ path, kind: 'changed', before: a.get(path), after: value });
    else if (options.includeUnchanged)
      rows.push({ path, kind: 'unchanged', before: value, after: value });
  }
  for (const [path, value] of a) {
    if (!b.has(path)) rows.push({ path, kind: 'removed', before: value });
  }
  return rows;
}

/** Display text of one snapshot value. */
export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '없음';
  if (typeof value === 'string') return value === '' ? '(빈 값)' : value;
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/** "2건 변경 · 1건 추가" style summary for list rows. */
export function summarizeDiff(rows: readonly DiffRow[]): string {
  const n = (kind: DiffKind) => rows.filter((r) => r.kind === kind).length;
  const parts = [
    n('changed') > 0 ? `${n('changed')}개 변경` : '',
    n('added') > 0 ? `${n('added')}개 추가` : '',
    n('removed') > 0 ? `${n('removed')}개 삭제` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '변경 내용 없음';
}
