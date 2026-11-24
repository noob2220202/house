import {
  canonicalAptSeq,
  complexNameVariants,
  normalizeEmdName,
  normalizeJibun,
  parseJibunAddress,
} from '@house/shared';
import { AREA_TYPE_MATCH_TOLERANCE_SQM } from '../constants';

export interface MatchableComplex {
  id: string;
  name: string;
  emdName: string | null;
  jibun: string | null;
  jibunAddress: string | null;
  externalCode: string | null;
  areaTypes: readonly { id: string; exclusiveArea: number }[];
}

export interface TradeIdentity {
  aptSeq: string | null;
  aptName: string;
  emdName: string | null;
  jibun: string | null;
}

interface Indexed {
  complex: MatchableComplex;
  /** externalCode with a legacy 시군구 prefix canonicalized (canonicalAptSeq). */
  seq: string | null;
  emd: string | null;
  /** Normalized 지번 (explicit, else parsed from the 지번주소). */
  jibun: string | null;
  names: Set<string>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** A different 국토교통부 code or a different 지번 rules a 단지 out, whatever the name says. */
function conflicts(c: Indexed, aptSeq: string | null, jibun: string | null): boolean {
  return (
    (aptSeq != null && c.seq != null && c.seq !== aptSeq) ||
    (jibun != null && c.jibun != null && c.jibun !== jibun)
  );
}

function only<T>(items: readonly T[]): T | null {
  return items.length === 1 ? (items[0] ?? null) : null;
}

/**
 * Matches 실거래 rows to 단지, most specific signal first:
 *   1. aptSeq = complexes.external_code
 *   2. 법정동 + 지번 (disambiguated by name when several 단지 share a 지번)
 *   3. 법정동 + normalized name variants
 *   4. normalized name, when unique in the 시군구 and the 법정동 does not contradict
 * Steps 2-4 drop candidates contradicted by a stronger signal (a different 국토교통부 code or a
 * different 지번), so same-named 단지 (현대, 부영, 주공…) never absorb each other's trades.
 * Ambiguous candidates never match: an unmatched trade is better than a wrong one.
 */
export class ComplexMatcher {
  private readonly bySeq = new Map<string, Indexed>();
  private readonly byEmdJibun = new Map<string, Indexed[]>();
  private readonly byEmdName = new Map<string, Indexed[]>();
  private readonly byName = new Map<string, Indexed[]>();
  private readonly byId = new Map<string, Indexed>();

  constructor(complexes: readonly MatchableComplex[]) {
    for (const complex of complexes) {
      const parsed = parseJibunAddress(complex.jibunAddress);
      const emd = normalizeEmdName(parsed.emdName ?? complex.emdName);
      const jibun = normalizeJibun(complex.jibun) ?? parsed.jibun;
      const names = new Set(complexNameVariants(complex.name, parsed.emdName ?? complex.emdName));
      const seq = complex.externalCode ? canonicalAptSeq(complex.externalCode) : null;
      const entry: Indexed = { complex, seq, emd, jibun, names };
      this.byId.set(complex.id, entry);
      if (seq) this.bySeq.set(seq, entry);
      if (emd && jibun) push(this.byEmdJibun, `${emd}|${jibun}`, entry);
      for (const n of names) {
        push(this.byName, n, entry);
        if (emd) push(this.byEmdName, `${emd}|${n}`, entry);
      }
    }
  }

  match(t: TradeIdentity): MatchableComplex | null {
    // Rows synced before 2026-07-01 still carry "46150-…" in raw.aptSeq (rematch reads it).
    const aptSeq = t.aptSeq ? canonicalAptSeq(t.aptSeq) : null;
    if (aptSeq) {
      const hit = this.bySeq.get(aptSeq);
      if (hit) return hit.complex;
    }
    const emd = normalizeEmdName(t.emdName);
    const variants = complexNameVariants(t.aptName, t.emdName);
    const jibun = normalizeJibun(t.jibun);
    const ok = (c: Indexed) => !conflicts(c, aptSeq, jibun);

    if (emd && jibun) {
      const candidates = (this.byEmdJibun.get(`${emd}|${jibun}`) ?? []).filter(ok);
      const unique = only(candidates);
      if (unique) return unique.complex;
      if (candidates.length > 1) {
        const named = only(candidates.filter((c) => variants.some((v) => c.names.has(v))));
        if (named) return named.complex;
      }
    }
    if (emd) {
      const hit = only(
        this.distinct(variants.map((v) => this.byEmdName.get(`${emd}|${v}`))).filter(ok),
      );
      if (hit) return hit.complex;
    }
    const byName = this.distinct(variants.map((v) => this.byName.get(v))).filter(
      (c) => ok(c) && (!emd || !c.emd || c.emd === emd),
    );
    return only(byName)?.complex ?? null;
  }

  /**
   * Where a trade belongs now: the current match, else the 단지 it is attached to as long as
   * keeps() allows (rows matched earlier are not dropped just because a name became ambiguous).
   */
  resolve(t: TradeIdentity, currentComplexId: string | null): MatchableComplex | null {
    const hit = this.match(t);
    if (hit) return hit;
    return currentComplexId && this.keeps(currentComplexId, t) ? this.get(currentComplexId) : null;
  }

  /** The indexed (live) 단지 with this id, if any. */
  get(complexId: string): MatchableComplex | null {
    return this.byId.get(complexId)?.complex ?? null;
  }

  /**
   * Whether a trade currently attached to `complexId` should stay there: false when the 단지 is
   * unknown (deleted) or a strong signal contradicts it. Weak ambiguity alone never detaches.
   */
  keeps(complexId: string, t: Pick<TradeIdentity, 'aptSeq' | 'jibun'>): boolean {
    const entry = this.byId.get(complexId);
    if (!entry) return false;
    const aptSeq = t.aptSeq ? canonicalAptSeq(t.aptSeq) : null;
    if (aptSeq && entry.seq === aptSeq) return true;
    return !conflicts(entry, aptSeq, normalizeJibun(t.jibun));
  }

  /** Nearest 평형 by 전용면적 within the tolerance (ties → first declared). */
  static areaTypeFor(complex: MatchableComplex, exclusiveArea: number): string | null {
    let best: { id: string; diff: number } | null = null;
    for (const at of complex.areaTypes) {
      const diff = Math.abs(at.exclusiveArea - exclusiveArea);
      if (diff <= AREA_TYPE_MATCH_TOLERANCE_SQM && (!best || diff < best.diff)) {
        best = { id: at.id, diff };
      }
    }
    return best?.id ?? null;
  }

  private distinct(lists: (Indexed[] | undefined)[]): Indexed[] {
    const out = new Map<string, Indexed>();
    for (const list of lists) for (const e of list ?? []) out.set(e.complex.id, e);
    return [...out.values()];
  }
}
