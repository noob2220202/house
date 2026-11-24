'use client';
import { Icon, cx, type IconName } from '@house/ui';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from '../tools.module.css';

interface ResultSummary {
  label: string;
  value: string;
}

/** ResultPanel → CalcSection: the headline shown in the mobile sticky summary. */
const SummaryContext = createContext<((summary: ResultSummary | null) => void) | null>(null);

/** Width at which the result drops below the inputs (tools.module.css `.calcBody`). */
const STACKED_QUERY = '(max-width: 880px)';
/** Viewport bottom band (tab bar + summary bar + the result's headline) that does not count as "seen". */
const BOTTOM_BAND_PX = 200;

/**
 * True while the calculator's inputs are on screen but its result headline is still below them —
 * phones and narrow tablets only (the result sits beside the inputs on wider screens).
 */
function useResultBelowFold(
  sectionRef: RefObject<HTMLElement | null>,
  resultRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const section = sectionRef.current;
    const result = resultRef.current;
    if (!enabled || !section || !result || typeof IntersectionObserver === 'undefined') {
      setBelow(false);
      return;
    }
    const stacked = window.matchMedia(STACKED_QUERY);
    let sectionIn = false;
    let resultBelow = false;
    const update = () => setBelow(stacked.matches && sectionIn && resultBelow);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === section) sectionIn = entry.isIntersecting;
          else resultBelow = !entry.isIntersecting && entry.boundingClientRect.top > 0;
        }
        update();
      },
      { rootMargin: `0px 0px -${BOTTOM_BAND_PX}px 0px` },
    );
    observer.observe(section);
    observer.observe(result);
    stacked.addEventListener('change', update);
    return () => {
      observer.disconnect();
      stacked.removeEventListener('change', update);
    };
  }, [enabled, sectionRef, resultRef]);
  return below;
}

export interface CalcSectionProps {
  /** Anchor id (footer links: #fee, #acquisition-tax, #transfer-tax, #loan, #area). */
  id: string;
  icon: IconName;
  title: string;
  description: string;
  /** Inputs (left on desktop). */
  form: ReactNode;
  /** Result panel (right on desktop, below the inputs on mobile). */
  result: ReactNode;
  /** Full-width extras under the two columns (rate table, schedule, notes). */
  children?: ReactNode;
}

/**
 * One calculator card: header, inputs + result side by side, optional details underneath. On
 * narrow screens, where the result sits below the inputs, a compact summary of its headline sticks
 * above the tab bar while the visitor types (tap → scrolls to the full result).
 */
export function CalcSection({
  id,
  icon,
  title,
  description,
  form,
  result,
  children,
}: CalcSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const showSummary = useResultBelowFold(sectionRef, resultRef, summary !== null);

  const scrollToResult = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <SummaryContext.Provider value={setSummary}>
      <section ref={sectionRef} id={id} className={styles.calc} aria-labelledby={`${id}-title`}>
        <header className={styles.calcHead}>
          <span className={styles.calcIcon} aria-hidden="true">
            <Icon name={icon} size={22} />
          </span>
          <div>
            <h2 id={`${id}-title`} className={styles.calcTitle}>
              {title}
            </h2>
            <p className={styles.calcDesc}>{description}</p>
          </div>
        </header>
        <div className={styles.calcBody}>
          <div className={styles.form}>{form}</div>
          <div className={styles.resultCol} ref={resultRef}>
            {result}
          </div>
        </div>
        {children && <div className={styles.calcExtra}>{children}</div>}
        {showSummary && summary && (
          <button type="button" className={styles.summaryBar} onClick={scrollToResult}>
            <span className={styles.summaryText}>
              <span className={styles.summaryLabel}>{summary.label}</span>
              <b className={cx(styles.summaryValue, 'num')}>{summary.value}</b>
            </span>
            <span className={styles.summaryGo}>
              자세히
              <Icon name="chevron-down" size={16} />
            </span>
          </button>
        )}
      </section>
    </SummaryContext.Provider>
  );
}

export interface ResultPanelProps {
  /** Caption above the headline, e.g. "중개보수 (상한)". */
  label: string;
  /** Headline amount, already formatted ("178만원"). Null → placeholder state. */
  value: string | null;
  /** Small line under the headline ("1,780,000원"). */
  sub?: ReactNode;
  /** Shown instead of the headline while the inputs are incomplete. */
  placeholder: string;
  children?: ReactNode;
}

/** Result well: big numeral headline + breakdown rows. Announces changes politely. */
export function ResultPanel({ label, value, sub, placeholder, children }: ResultPanelProps) {
  const setSummary = useContext(SummaryContext);
  useEffect(() => {
    setSummary?.(value === null ? null : { label, value });
  }, [setSummary, label, value]);
  useEffect(() => () => setSummary?.(null), [setSummary]);

  return (
    <div className={styles.result} role="status" aria-live="polite" aria-atomic="true">
      <p className={styles.resultLabel}>{label}</p>
      {value === null ? (
        <p className={styles.resultEmpty}>{placeholder}</p>
      ) : (
        <>
          <p className={styles.resultValue}>{value}</p>
          {sub && <p className={styles.resultSub}>{sub}</p>}
          {children}
        </>
      )}
    </div>
  );
}

export interface ResultRow {
  label: ReactNode;
  value: ReactNode;
  /** Emphasised total row. */
  strong?: boolean;
  /** Caption under the label. */
  note?: ReactNode;
}

export function ResultRows({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((row, i) => (
        <div key={i} className={row.strong ? styles.rowStrong : styles.row}>
          <dt>
            {row.label}
            {row.note && <span className={styles.rowNote}>{row.note}</span>}
          </dt>
          <dd className="num">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Label + control group for segmented choices (keeps label typography equal to <Input label>). */
export function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.choice}>
      <span className={styles.choiceLabel}>{label}</span>
      {children}
    </div>
  );
}

/** Bulleted fine print under a calculator. */
export function Notes({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className={styles.notes}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
