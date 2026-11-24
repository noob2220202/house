'use client';
import { Button, Icon, cx } from '@house/ui';
import { useState } from 'react';
import { Glyph } from './icons';
import styles from './page.module.css';

export interface DescriptionSectionProps {
  paragraphs: readonly string[];
  highlights: readonly string[];
  /** "신대중앙 공인중개사사무소 작성 · 26.11.20" */
  byline: string | null;
}

/** Paragraphs shown before "설명 더보기" (after the lead). */
const COLLAPSED_BODY = 2;

/** 매물 설명 — broker-written text, rendered as plain text (never as HTML). */
export function DescriptionSection({ paragraphs, highlights, byline }: DescriptionSectionProps) {
  const [open, setOpen] = useState(false);
  const [lead, ...body] = paragraphs;
  const long = body.length > COLLAPSED_BODY;
  const hasMoreOnMobile = body.join('').length > 90;

  return (
    <section className={styles.sec} aria-labelledby="s-desc">
      <div className={styles.secHd}>
        <h2 className={styles.secT} id="s-desc">
          매물 설명
        </h2>
        {byline && <span className="t-cap">{byline}</span>}
      </div>
      {highlights.length > 0 && (
        <ul className={styles.hl}>
          {highlights.map((h) => (
            <li key={h}>
              <Glyph name="bulb" size={16} />
              {h}
            </li>
          ))}
        </ul>
      )}
      {lead ? (
        <div id="listing-desc" className={cx(styles.desc, !open && styles.descClosed)}>
          <p className={styles.descLead}>{lead}</p>
          {body.map((p, i) => (
            <p key={i} className={cx(i >= COLLAPSED_BODY && styles.descExtra)}>
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className="t-sm">
          중개사무소가 아직 설명을 적지 않았어요. 궁금한 점은 문의하기로 물어보세요.
        </p>
      )}
      {(long || hasMoreOnMobile) && (
        <Button
          variant="secondary"
          size="sm"
          className={cx(styles.descMore, !long && 'only-sm')}
          aria-expanded={open}
          aria-controls="listing-desc"
          onClick={() => setOpen((v) => !v)}
          iconRight={<Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />}
        >
          {open ? '설명 접기' : '설명 더보기'}
        </Button>
      )}
    </section>
  );
}
