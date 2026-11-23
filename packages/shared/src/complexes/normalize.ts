/**
 * Name / 지번 normalization used to match 국토교통부 실거래 rows (aptNm, umdNm, jibun) to 단지.
 * Pure functions so the frontends can reuse them (e.g. duplicate checks in the admin).
 */

const BRACKETED = /[([{（［【〔][^)\]}）］】〕]*[)\]}）］】〕]/g;
const PUNCT_AND_SPACE = /[\s·•.,'"`~!@#$%^&*_+=|\\/:;?<>()[\]{}（）［］【】〔〕-]/g;
const TRAILING_SUFFIX = /(아파트|apt|apartment)$/;

function base(name: string): string {
  return name.normalize('NFKC').toLowerCase().trim();
}

function squash(name: string): string {
  return name.replace(PUNCT_AND_SPACE, '').replace(TRAILING_SUFFIX, '');
}

/** "순천 연향 부영아파트(3차)" → "순천연향부영3차" */
export function normalizeComplexName(name: string): string {
  return squash(base(name));
}

/** 법정동 key: last token ("해룡면 신대리" → "신대리"), NFKC, no spaces. */
export function normalizeEmdName(emdName: string | null | undefined): string | null {
  if (!emdName) return null;
  const tokens = base(emdName).split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  return last ? last.replace(PUNCT_AND_SPACE, '') : null;
}

/**
 * Every spelling a 단지 may appear under: the full name, the name without bracketed parts, and
 * both without a leading 법정동 prefix ("연향동부영3차" / "연향부영3차" → "부영3차").
 */
export function complexNameVariants(name: string, emdName?: string | null): string[] {
  const raw = base(name);
  const candidates = new Set<string>([squash(raw), squash(raw.replace(BRACKETED, ''))]);
  const emd = normalizeEmdName(emdName);
  if (emd) {
    const prefixes = [emd, emd.replace(/(동|리|읍|면|가)$/, '')].filter((p) => p.length >= 1);
    for (const v of [...candidates]) {
      for (const p of prefixes) {
        if (v.startsWith(p) && v.length - p.length >= 2) candidates.add(v.slice(p.length));
      }
    }
  }
  candidates.delete('');
  return [...candidates];
}

const JIBUN_RE = /^(산)?0*(\d{1,5})(?:-0*(\d{0,5}))?(?:번지)?$/;

/** "0123-0004" → "123-4", "123-0" → "123", "산 12" → "산12"; null when not a 지번. */
export function normalizeJibun(jibun: string | null | undefined): string | null {
  if (!jibun) return null;
  const m = JIBUN_RE.exec(jibun.normalize('NFKC').replace(/\s+/g, ''));
  if (!m) return null;
  const [, san = '', bon = '', bu = ''] = m;
  const main = `${san}${bon === '' ? '0' : bon}`;
  return bu === '' || /^0*$/.test(bu) ? main : `${main}-${bu.replace(/^0+/, '')}`;
}

/** "전라남도 순천시 연향동 1234-5" → { emdName: "연향동", jibun: "1234-5" } (best effort). */
export function parseJibunAddress(address: string | null | undefined): {
  emdName: string | null;
  jibun: string | null;
} {
  if (!address) return { emdName: null, jibun: null };
  const tokens = address.normalize('NFKC').trim().split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    let token = tokens[i] ?? '';
    if (token === '산' && tokens[i + 1]) token = `산${tokens[i + 1]}`;
    const jibun = normalizeJibun(token);
    if (!jibun) continue;
    const before = tokens.slice(0, i).reverse();
    const emd = before.find((t) => /(동|리|가)$/.test(t)) ?? null;
    return { emdName: emd, jibun };
  }
  return { emdName: null, jibun: null };
}
