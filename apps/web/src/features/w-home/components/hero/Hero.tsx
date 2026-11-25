import { Icon } from '@house/ui';
import { BRAND } from '@/config/brand';
import type { HomeSummary, ListingItem } from '../../api/schemas';
import { HeroMap } from './HeroMap';
import { HeroSearch } from './HeroSearch';
import styles from './Hero.module.css';

const PROMISES = ['실매물 확인을 마친 매물만', '공동중개 매물은 1건으로', '허위매물 신고 접수'];

export interface HeroProps {
  summary: HomeSummary | undefined;
  /** Listing shown on the hero map card (the most recently verified one). */
  featured: ListingItem | undefined;
}

/** Home hero: headline, search with autocomplete + quick chips, and the district map (≥ 721px). */
export function Hero({ summary, featured }: HeroProps) {
  const regions = (summary?.regions ?? []).map(({ name, lat, lng }) => ({ name, lat, lng }));
  return (
    <section className={styles.hero} aria-labelledby="hero-h">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.pill}>
            <Icon name="check-circle" size={16} />
            순천 공인중개사들이 함께 올리는 실매물
          </p>
          <h1 id="hero-h" className={styles.title}>
            순천의 집, <br />
            <span className={styles.hl}>한 번의 검색</span>으로
          </h1>
          <p className={styles.lead}>
            같은 집을 여러 중개사무소가 올려도 한 번만 보여드려요.
            <br className={styles.leadBr} /> 실매물 확인 날짜와 함께 보는 중개사무소까지 한눈에.
          </p>
          <HeroSearch regions={regions} />
          <ul className={styles.promise} aria-label={`${BRAND.name} 매물 원칙`}>
            {PROMISES.map((text) => (
              <li key={text}>
                <Icon name="check" size={18} />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <HeroMap summary={summary} featured={featured} />
      </div>
    </section>
  );
}
