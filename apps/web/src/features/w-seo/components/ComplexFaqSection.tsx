import Link from 'next/link';
import type { FaqItem } from '../lib/complex-faq';
import { seoStyles as styles } from './parts';

/**
 * "자주 묻는 질문" block under the 단지 page: plain, server-rendered facts (준공, 세대수·평형,
 * 최근 실거래, 매물, 위치) that answer engines can quote; the same items feed FAQPage JSON-LD.
 */
export function ComplexFaqSection({
  name,
  items,
  regionLink,
}: {
  name: string;
  items: readonly FaqItem[];
  /** The 지역 landing page of the 단지 (internal link), when indexable. */
  regionLink?: { href: string; label: string } | null;
}) {
  if (items.length === 0) return null;
  return (
    <div className="container">
      <section className={styles.sec} id="faq" aria-labelledby="faq-title">
        <div className={styles.secHd}>
          <h2 className={styles.secT} id="faq-title">
            {name} 자주 묻는 질문
          </h2>
          {regionLink && (
            <Link className="link t-sm" href={regionLink.href}>
              {regionLink.label}
            </Link>
          )}
        </div>
        <div className={styles.faq}>
          {items.map((f) => (
            <div key={f.question} className={styles.faqItem}>
              <h3 className={styles.faqQ}>{f.question}</h3>
              <p className={styles.faqA}>{f.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
