import type { FaqCategory } from '@house/shared';
import type { Faq } from '../api/schemas';

/** Display labels of the FAQ categories (order = chip order). */
export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  GENERAL: '서비스 이용',
  ACCOUNT: '회원 · 로그인',
  LISTING: '매물',
  AGENCY: '중개사무소',
  DEAL_REQUEST: '내놓기 · 구하기',
  AD: '광고',
};
export const FAQ_CATEGORY_ORDER = Object.keys(FAQ_CATEGORY_LABEL) as FaqCategory[];

export type FaqFilter = FaqCategory | 'ALL';

export function isFaqCategory(value: unknown): value is FaqCategory {
  return typeof value === 'string' && (FAQ_CATEGORY_ORDER as string[]).includes(value);
}

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

/** Category + text filter. The text matches question or answer, ignoring case and whitespace. */
export function filterFaqs(faqs: readonly Faq[], category: FaqFilter, query: string): Faq[] {
  const q = normalize(query);
  return faqs.filter(
    (f) =>
      (category === 'ALL' || f.category === category) &&
      (q === '' || normalize(f.question).includes(q) || normalize(f.answer).includes(q)),
  );
}

/** Number of FAQs per category (only categories that have at least one). */
export function countByCategory(faqs: readonly Faq[]): Partial<Record<FaqCategory, number>> {
  const out: Partial<Record<FaqCategory, number>> = {};
  for (const f of faqs) out[f.category] = (out[f.category] ?? 0) + 1;
  return out;
}

/** Splits `text` around case-insensitive occurrences of `query` for <mark> highlighting. */
export function splitHighlight(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (q === '') return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) out.push({ text: text.slice(from, at), hit: false });
    out.push({ text: text.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
}
