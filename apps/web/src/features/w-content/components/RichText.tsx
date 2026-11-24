import { cx } from '@house/ui';
import { Fragment } from 'react';
import { headingId, parseRichText, type Inline } from '../lib/rich-text';
import styles from './RichText.module.css';

export interface RichTextProps {
  /** Plain text from the API (notices, FAQ answers, terms). Never rendered as HTML. */
  source: string;
  /** Prefix of the generated heading ids (in-page anchors / table of contents). */
  idPrefix?: string;
  /** `doc` = long-form reading (terms, notices); `compact` = FAQ answers. */
  variant?: 'doc' | 'compact';
  /**
   * Tag of the top-level (`## ` / 제n조) headings; sub-headings are one level deeper. Default 2 —
   * right under the page's h1. Use 3 when the text sits under an h2 (FAQ answers). The look
   * does not change with the level.
   */
  headingLevel?: 2 | 3;
  className?: string;
}

const HEADING_TAGS: Record<number, 'h2' | 'h3' | 'h4'> = { 2: 'h2', 3: 'h3', 4: 'h4' };

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow">
            {part.text}
          </a>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Safe renderer for operator-written plain text with light markup (see lib/rich-text.ts). */
export function RichText({
  source,
  idPrefix = 'sec',
  variant = 'doc',
  headingLevel = 2,
  className,
}: RichTextProps) {
  const blocks = parseRichText(source);
  let headingIndex = -1;
  return (
    <div className={cx(styles.rich, variant === 'compact' && styles.compact, className)}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          headingIndex += 1;
          const Tag = HEADING_TAGS[headingLevel + (block.level - 2)] ?? 'h4';
          return (
            <Tag
              key={i}
              id={headingId(idPrefix, headingIndex)}
              className={block.level === 2 ? styles.h2 : styles.h3}
            >
              {block.text}
            </Tag>
          );
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag key={i} className={block.ordered ? styles.ol : styles.ul}>
              {block.items.map((item, j) => (
                <li key={j} value={item.marker ? Number(item.marker) : undefined}>
                  <Inlines parts={item.content} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inlines parts={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Headings of a document for a table of contents: [{ id, text }]. */
export function richTextHeadings(source: string, idPrefix = 'sec'): { id: string; text: string }[] {
  return parseRichText(source)
    .filter((b) => b.type === 'heading')
    .map((b, i) => ({ id: headingId(idPrefix, i), text: b.text }));
}
