import { cx } from '@house/ui';
import { Fragment } from 'react';
import { parseRichText, type Inline } from '../lib/rich-text';
import styles from './RichPreview.module.css';

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) =>
        node.type === 'link' ? (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {node.text}
          </a>
        ) : (
          <Fragment key={i}>{node.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Renders operator-written text exactly like the user site: the plain-text markup is parsed into
 * blocks and rendered as React elements — never as HTML (no dangerouslySetInnerHTML).
 */
export function RichPreview({
  source,
  compact,
  emptyText = '내용을 입력하면 미리보기가 여기에 보여요.',
  className,
}: {
  source: string;
  compact?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const blocks = parseRichText(source);
  if (blocks.length === 0) return <p className={styles.emptyNote}>{emptyText}</p>;
  return (
    <div className={cx(styles.rich, compact && styles.compact, className)}>
      {blocks.map((block, i) => {
        if (block.type === 'heading')
          return block.level === 2 ? <h3 key={i}>{block.text}</h3> : <h4 key={i}>{block.text}</h4>;
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={i}>
              {block.items.map((item, j) => (
                <li key={j}>
                  {item.marker !== null && <span className={styles.marker}>{item.marker}.</span>}
                  <InlineNodes nodes={item.content} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <InlineNodes nodes={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
