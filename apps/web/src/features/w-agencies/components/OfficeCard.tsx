import { AgencyLogo, Button, Icon, cx } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format';
import type { AgencySummary } from '../api/schemas';
import { SPECIALTY_LABEL, shortAddress, telHref } from '../lib/agency';
import styles from './office.module.css';

export interface OfficeCardProps {
  agency: AgencySummary;
  selected?: boolean;
  /**
   * Plain left click on the card → open the profile panel instead of navigating. The link itself
   * still points at the public agency page (crawlers, new-tab, no-JS).
   */
  onSelect?: (agency: AgencySummary) => void;
  headingLevel?: 2 | 3;
}

/** Office search result (`.ocard`): avatar, 상호, 대표 · 매물 수, 주소, 등록번호, 전문 단지, 전화. */
export function OfficeCard({ agency, selected, onSelect, headingLevel = 3 }: OfficeCardProps) {
  const Heading: 'h2' | 'h3' = `h${headingLevel}`;
  const tel = telHref(agency.phone);
  const tags =
    agency.topComplexes.length > 0
      ? agency.topComplexes.slice(0, 2).map((c) => ({ key: c.id, label: c.name }))
      : agency.specialties.slice(0, 2).map((s) => ({ key: s, label: SPECIALTY_LABEL[s] }));

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onSelect || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(agency);
  };

  return (
    <article className={cx(styles.card, selected && styles.on)}>
      <div className={styles.top}>
        <AgencyLogo
          name={agency.name}
          seed={agency.id}
          size={56}
          image={
            agency.logoUrl ? <Image src={agency.logoUrl} alt="" fill sizes="56px" /> : undefined
          }
        />
        <div className={styles.main}>
          <Heading className={styles.name}>
            <Link
              href={ROUTES.agency(agency.id)}
              className={styles.nameLink}
              onClick={handleClick}
              aria-current={selected ? 'true' : undefined}
            >
              {agency.name}
            </Link>
          </Heading>
          <p className={styles.ceo}>
            <span>
              대표 공인중개사 <b>{agency.representativeName}</b>
            </span>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              매물 <b className="num">{formatCount(agency.activeListingCount)}</b>
            </span>
          </p>
          <p className={styles.addr}>{shortAddress(agency)}</p>
          <p className={styles.reg}>
            등록번호 <span className="num">{agency.registrationNumber}</span>
          </p>
        </div>
      </div>
      <div className={styles.foot}>
        <ul
          className={styles.tags}
          aria-label={agency.topComplexes.length > 0 ? '전문 단지' : '전문 분야'}
        >
          {tags.map((t) => (
            <li key={t.key} className={styles.tag}>
              {t.label}
            </li>
          ))}
        </ul>
        {tel && (
          <Button
            href={tel}
            size="sm"
            variant={selected ? 'primary' : 'secondary'}
            className={styles.call}
            iconLeft={<Icon name="phone" size={16} />}
            aria-label={`${agency.name}에 전화`}
          >
            전화
          </Button>
        )}
      </div>
    </article>
  );
}
