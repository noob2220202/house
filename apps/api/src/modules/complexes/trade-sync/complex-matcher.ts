import {
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
  emd: string | null;
  names: Set<string>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
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
 * Ambiguous candidates never match: an unmatched trade is better than a wrong one.
 */
export class ComplexMatcher {
  private readonly bySeq = new Map<string, Indexed>();
  private readonly byEmdJibun = new Map<string, Indexed[]>();
  private readonly byEmdName = new Map<string, Indexed[]>();
  private readonly byName = new Map<string, Indexed[]>();

  constructor(complexes: readonly MatchableComplex[]) {
    for (const complex of complexes) {
      const parsed = parseJibunAddress(complex.jibunAddress);
      const emd = normalizeEmdName(parsed.emdName ?? complex.emdName);
      const jibun = normalizeJibun(complex.jibun) ?? parsed.jibun;
      const names = new Set(complexNameVariants(complex.name, parsed.emdName ?? complex.emdName));
      const entry: Indexed = { complex, emd, names };
      if (complex.externalCode) this.bySeq.set(complex.externalCode, entry);
      if (emd && jibun) push(this.byEmdJibun, `${emd}|${jibun}`, entry);
      for (const n of names) {
        push(this.byName, n, entry);
        if (emd) push(this.byEmdName, `${emd}|${n}`, entry);
      }
    }
  }

  match(t: TradeIdentity): MatchableComplex | null {
    if (t.aptSeq) {
      const hit = this.bySeq.get(t.aptSeq);
      if (hit) return hit.complex;
    }
    const emd = normalizeEmdName(t.emdName);
    const variants = complexNameVariants(t.aptName, t.emdName);
    const jibun = normalizeJibun(t.jibun);

    if (emd && jibun) {
      const candidates = this.byEmdJibun.get(`${emd}|${jibun}`) ?? [];
      const unique = only(candidates);
      if (unique) return unique.complex;
      if (candidates.length > 1) {
        const named = only(candidates.filter((c) => variants.some((v) => c.names.has(v))));
        if (named) return named.complex;
      }
    }
    if (emd) {
      const hit = only(this.distinct(variants.map((v) => this.byEmdName.get(`${emd}|${v}`))));
      if (hit) return hit.complex;
    }
    const byName = this.distinct(variants.map((v) => this.byName.get(v))).filter(
      (c) => !emd || !c.emd || c.emd === emd,
    );
    return only(byName)?.complex ?? null;
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
