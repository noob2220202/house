import type { ReactNode } from 'react';
import styles from './BrokerCard.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';
import { PhotoPlaceholder } from './PhotoPlaceholder';
import { Icon } from '../icons/Icon';

export interface BrokerCardProps {
  /** 중개사무소 명칭. */
  name: string;
  /** Link to the agency page (stretches over the card when set). */
  href?: string;
  linkAs?: LinkAs;
  /** Specialty tag with a star: "신대 레이크파크 단지 전문". */
  specialty?: string;
  /** Meta lines: 대표 · 매물 수, 주소 … (each entry is one line). */
  meta?: readonly ReactNode[];
  /** Featured (ink) variant — e.g. the complex's dedicated agency. */
  featured?: boolean;
  /** Right-side action, usually a 전화 button (`<Button size="sm" href="tel:…">`). */
  action?: ReactNode;
  /** Logo/photo node; falls back to the office illustration. */
  media?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Broker office card (`.bcard`). */
export function BrokerCard({
  name,
  href,
  linkAs,
  specialty,
  meta,
  featured,
  action,
  media,
  headingLevel = 3,
  className,
}: BrokerCardProps) {
  const Heading: 'h2' | 'h3' | 'h4' = `h${headingLevel}`;
  const Link = linkAs ?? 'a';
  return (
    <article className={cx(styles.card, featured && styles.feature, className)}>
      <span className={styles.photo}>{media ?? <PhotoPlaceholder kind="office" />}</span>
      <div className={styles.text}>
        {specialty && (
          <span className={styles.tag}>
            <Icon name="star" size={14} />
            {specialty}
          </span>
        )}
        <Heading className={styles.name}>
          {href ? (
            <Link href={href} className={styles.link}>
              {name}
            </Link>
          ) : (
            name
          )}
        </Heading>
        {meta && meta.length > 0 && (
          <p className={styles.meta}>
            {meta.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </p>
        )}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </article>
  );
}
