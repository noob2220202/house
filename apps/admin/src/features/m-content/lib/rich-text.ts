import { isSafeLinkUrl } from '@house/shared';

/**
 * Tiny, safe text → blocks parser for operator-written content (notices, FAQ answers, terms).
 * PORTED VERBATIM from apps/web/src/features/w-content/lib/rich-text.ts so the admin preview renders
 * exactly what the user site renders — keep the two files in sync (candidate for packages/shared).
 * The API returns PLAIN TEXT; nothing is ever injected as HTML. Supported markup:
 *   "## 제목" / "# 제목" / "### 소제목"      headings
 *   "제1조 (목적)" · "부칙"                    article headings of terms documents
 *   "- 항목" · "• 항목"                        bullet list
 *   "1. 항목" · "2) 항목"                      numbered list (numbers are kept as written)
 *   blank line                                 paragraph break; single line breaks are preserved
 *   http(s)://…                                auto-linked (http/https only)
 */
export type Inline = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };

export type RichBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; lines: Inline[][] }
  | { type: 'list'; ordered: boolean; items: { marker: string | null; content: Inline[] }[] };

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING_PUNCT = /[.,;:!?)\]}'"。、]+$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const start = match.index;
    const href = raw.replace(TRAILING_PUNCT, '');
    if (!isSafeLinkUrl(href)) continue;
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) });
    out.push({ type: 'link', text: href, href });
    last = start + href.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const ARTICLE_RE = /^(제\s*\d+\s*(?:조|장)(?:의\s*\d+)?)(?:\s|\(|\[|$)/;
const BULLET_RE = /^[-•·*]\s+(.+)$/;
const ORDERED_RE = /^(\d{1,3})[.)]\s+(.+)$/;

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: Inline[][] = [];
  let list: Extract<RichBlock, { type: 'list' }> | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      flush();
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', level: heading[1]!.length >= 3 ? 3 : 2, text: heading[2]! });
      continue;
    }
    if (ARTICLE_RE.test(line) || line === '부칙') {
      flush();
      blocks.push({ type: 'heading', level: 2, text: line });
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    const ordered = bullet ? null : ORDERED_RE.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = !!ordered;
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { type: 'list', ordered: isOrdered, items: [] };
      list.items.push(
        ordered
          ? { marker: ordered[1]!, content: parseInline(ordered[2]!) }
          : { marker: null, content: parseInline(bullet![1]!) },
      );
      continue;
    }
    flushList();
    paragraph.push(parseInline(line));
  }
  flush();
  return blocks;
}

/** First ~`max` characters of the text without markup — meta descriptions and list previews. */
export function plainExcerpt(source: string, max = 150): string {
  const text = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^#{1,3}\s+/, '')
        .replace(/^[-•·*]\s+/, ''),
    )
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Slug-safe heading ids for in-page anchors: index-based so Korean headings never collide. */
export function headingId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}
