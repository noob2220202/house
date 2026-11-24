'use client';
import { Button, Chip, EmptyState, Icon, Input, cx } from '@house/ui';
import { useId, useMemo, useState } from 'react';
import type { Faq } from '../api/schemas';
import { RichText } from '../components/RichText';
import {
  FAQ_CATEGORY_LABEL,
  FAQ_CATEGORY_ORDER,
  countByCategory,
  filterFaqs,
  splitHighlight,
  type FaqFilter,
} from './faq-utils';
import styles from './faq.module.css';

export interface FaqBrowserProps {
  faqs: readonly Faq[];
  initialCategory?: FaqFilter;
  initialQuery?: string;
}

/** FAQ list with category chips, instant text search and an accessible accordion. */
export function FaqBrowser({ faqs, initialCategory = 'ALL', initialQuery = '' }: FaqBrowserProps) {
  const [category, setCategory] = useState<FaqFilter>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const baseId = useId();

  const counts = useMemo(() => countByCategory(faqs), [faqs]);
  const categories = FAQ_CATEGORY_ORDER.filter((c) => (counts[c] ?? 0) > 0);
  const visible = useMemo(() => filterFaqs(faqs, category, query), [faqs, category, query]);
  const searching = query.trim() !== '';

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const reset = () => {
    setCategory('ALL');
    setQuery('');
  };

  return (
    <div>
      <div className={styles.tools}>
        <div className={styles.search}>
          <Input
            type="search"
            aria-label="자주 묻는 질문 검색"
            placeholder="궁금한 내용을 검색해 보세요 (예: 허위매물, 탈퇴)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<Icon name="search" size={20} />}
            enterKeyHint="search"
          />
        </div>
        <div className={styles.chips} role="group" aria-label="질문 분류">
          <Chip selected={category === 'ALL'} onClick={() => setCategory('ALL')}>
            전체 <span className={styles.chipCount}>{faqs.length}</span>
          </Chip>
          {categories.map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
              {FAQ_CATEGORY_LABEL[c]} <span className={styles.chipCount}>{counts[c]}</span>
            </Chip>
          ))}
        </div>
      </div>

      <p className={styles.summary} role="status" aria-live="polite">
        {searching ? (
          <>
            <b>&lsquo;{query.trim()}&rsquo;</b> 검색 결과 <b className="num">{visible.length}</b>건
          </>
        ) : (
          <>
            {category === 'ALL' ? '전체' : FAQ_CATEGORY_LABEL[category]}{' '}
            <b className="num">{visible.length}</b>건
          </>
        )}
      </p>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            title="조건에 맞는 질문이 없어요"
            description="다른 낱말로 검색하거나 분류를 바꿔 보세요."
            action={
              <Button variant="secondary" onClick={reset}>
                전체 질문 보기
              </Button>
            }
          />
        </div>
      ) : (
        <ul className={styles.list}>
          {visible.map((faq) => {
            const open = openIds.has(faq.id);
            const buttonId = `${baseId}-q-${faq.id}`;
            const panelId = `${baseId}-a-${faq.id}`;
            return (
              <li key={faq.id} className={cx(styles.item, open && styles.open)}>
                <h2 className={styles.qh}>
                  <button
                    type="button"
                    id={buttonId}
                    className={styles.q}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggle(faq.id)}
                  >
                    <span className={styles.qMark} aria-hidden="true">
                      Q
                    </span>
                    <span className={styles.qBody}>
                      <span className={styles.qCat}>{FAQ_CATEGORY_LABEL[faq.category]}</span>
                      <span className={styles.qText}>
                        {splitHighlight(faq.question, query).map((part, i) =>
                          part.hit ? <mark key={i}>{part.text}</mark> : part.text,
                        )}
                      </span>
                    </span>
                    <Icon name="chevron-down" size={20} className={styles.caret} />
                  </button>
                </h2>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={styles.a}
                  hidden={!open}
                >
                  <span className={styles.aMark} aria-hidden="true">
                    A
                  </span>
                  <RichText
                    source={faq.answer}
                    variant="compact"
                    idPrefix={`faq-${faq.id}`}
                    headingLevel={3}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
