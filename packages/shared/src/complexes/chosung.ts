/** 초성 (initial consonant) search helpers: "ㅇㅎㅂㅇ" matches "연향부영". */

const CHOSUNG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const;
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const JAMO_CONSONANT = /^[ㄱ-ㅎ]$/;

function chosungOfChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) {
    return CHOSUNG[Math.floor((code - HANGUL_START) / 588)] ?? ch;
  }
  return ch;
}

function chars(s: string): string[] {
  return [...s.normalize('NFC').toLowerCase().replace(/\s+/g, '')];
}

/** "연향 부영" → "ㅇㅎㅂㅇ" (non-Hangul characters are kept, spaces dropped). */
export function toChosung(s: string): string {
  return chars(s).map(chosungOfChar).join('');
}

/** True when the query contains at least one bare consonant (ㄱ-ㅎ), i.e. needs 초성 matching. */
export function isChosungQuery(q: string): boolean {
  return chars(q).some((c) => JAMO_CONSONANT.test(c));
}

/**
 * Substring match where each bare consonant in `q` matches any syllable with that 초성 and every
 * other character must match exactly: "ㅇㅎ부영" matches "연향부영3차".
 */
export function matchesChosung(text: string, q: string): boolean {
  const t = chars(text);
  const p = chars(q);
  if (p.length === 0) return true;
  outer: for (let i = 0; i + p.length <= t.length; i++) {
    for (let j = 0; j < p.length; j++) {
      const pc = p[j] as string;
      const tc = t[i + j] as string;
      if (pc === tc) continue;
      if (JAMO_CONSONANT.test(pc) && chosungOfChar(tc) === pc) continue;
      continue outer;
    }
    return true;
  }
  return false;
}
