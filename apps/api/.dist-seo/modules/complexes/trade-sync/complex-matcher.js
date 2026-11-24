"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexMatcher = void 0;
const shared_1 = require("@house/shared");
const constants_1 = require("../constants");
function push(map, key, value) {
    const list = map.get(key);
    if (list)
        list.push(value);
    else
        map.set(key, [value]);
}
/** A different 국토교통부 code or a different 지번 rules a 단지 out, whatever the name says. */
function conflicts(c, aptSeq, jibun) {
    return ((aptSeq != null && c.seq != null && c.seq !== aptSeq) ||
        (jibun != null && c.jibun != null && c.jibun !== jibun));
}
function only(items) {
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
class ComplexMatcher {
    constructor(complexes) {
        this.bySeq = new Map();
        this.byEmdJibun = new Map();
        this.byEmdName = new Map();
        this.byName = new Map();
        this.byId = new Map();
        for (const complex of complexes) {
            const parsed = (0, shared_1.parseJibunAddress)(complex.jibunAddress);
            const emd = (0, shared_1.normalizeEmdName)(parsed.emdName ?? complex.emdName);
            const jibun = (0, shared_1.normalizeJibun)(complex.jibun) ?? parsed.jibun;
            const names = new Set((0, shared_1.complexNameVariants)(complex.name, parsed.emdName ?? complex.emdName));
            const seq = complex.externalCode ? (0, shared_1.canonicalAptSeq)(complex.externalCode) : null;
            const entry = { complex, seq, emd, jibun, names };
            this.byId.set(complex.id, entry);
            if (seq)
                this.bySeq.set(seq, entry);
            if (emd && jibun)
                push(this.byEmdJibun, `${emd}|${jibun}`, entry);
            for (const n of names) {
                push(this.byName, n, entry);
                if (emd)
                    push(this.byEmdName, `${emd}|${n}`, entry);
            }
        }
    }
    match(t) {
        // Rows synced before 2026-07-01 still carry "46150-…" in raw.aptSeq (rematch reads it).
        const aptSeq = t.aptSeq ? (0, shared_1.canonicalAptSeq)(t.aptSeq) : null;
        if (aptSeq) {
            const hit = this.bySeq.get(aptSeq);
            if (hit)
                return hit.complex;
        }
        const emd = (0, shared_1.normalizeEmdName)(t.emdName);
        const variants = (0, shared_1.complexNameVariants)(t.aptName, t.emdName);
        const jibun = (0, shared_1.normalizeJibun)(t.jibun);
        const ok = (c) => !conflicts(c, aptSeq, jibun);
        if (emd && jibun) {
            const candidates = (this.byEmdJibun.get(`${emd}|${jibun}`) ?? []).filter(ok);
            const unique = only(candidates);
            if (unique)
                return unique.complex;
            if (candidates.length > 1) {
                const named = only(candidates.filter((c) => variants.some((v) => c.names.has(v))));
                if (named)
                    return named.complex;
            }
        }
        if (emd) {
            const hit = only(this.distinct(variants.map((v) => this.byEmdName.get(`${emd}|${v}`))).filter(ok));
            if (hit)
                return hit.complex;
        }
        const byName = this.distinct(variants.map((v) => this.byName.get(v))).filter((c) => ok(c) && (!emd || !c.emd || c.emd === emd));
        return only(byName)?.complex ?? null;
    }
    /**
     * Where a trade belongs now: the current match, else the 단지 it is attached to as long as
     * keeps() allows (rows matched earlier are not dropped just because a name became ambiguous).
     */
    resolve(t, currentComplexId) {
        const hit = this.match(t);
        if (hit)
            return hit;
        return currentComplexId && this.keeps(currentComplexId, t) ? this.get(currentComplexId) : null;
    }
    /** The indexed (live) 단지 with this id, if any. */
    get(complexId) {
        return this.byId.get(complexId)?.complex ?? null;
    }
    /**
     * Whether a trade currently attached to `complexId` should stay there: false when the 단지 is
     * unknown (deleted) or a strong signal contradicts it. Weak ambiguity alone never detaches.
     */
    keeps(complexId, t) {
        const entry = this.byId.get(complexId);
        if (!entry)
            return false;
        const aptSeq = t.aptSeq ? (0, shared_1.canonicalAptSeq)(t.aptSeq) : null;
        if (aptSeq && entry.seq === aptSeq)
            return true;
        return !conflicts(entry, aptSeq, (0, shared_1.normalizeJibun)(t.jibun));
    }
    /** Nearest 평형 by 전용면적 within the tolerance (ties → first declared). */
    static areaTypeFor(complex, exclusiveArea) {
        let best = null;
        for (const at of complex.areaTypes) {
            const diff = Math.abs(at.exclusiveArea - exclusiveArea);
            if (diff <= constants_1.AREA_TYPE_MATCH_TOLERANCE_SQM && (!best || diff < best.diff)) {
                best = { id: at.id, diff };
            }
        }
        return best?.id ?? null;
    }
    distinct(lists) {
        const out = new Map();
        for (const list of lists)
            for (const e of list ?? [])
                out.set(e.complex.id, e);
        return [...out.values()];
    }
}
exports.ComplexMatcher = ComplexMatcher;
//# sourceMappingURL=complex-matcher.js.map