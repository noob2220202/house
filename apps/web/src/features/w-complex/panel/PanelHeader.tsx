'use client';
import { ASSET_TYPE_LABEL } from '@house/shared';
import { Icon, cx } from '@house/ui';
import Link from 'next/link';
import { Fragment } from 'react';
import { ROUTES } from '@/config/nav';
import type { ComplexDetail } from '../api/schemas';
import { useFavorite } from '@/lib/favorites/useFavorite';
import { useShare } from '../hooks/useShare';
import { complexFacts } from '../lib/complex';
import styles from './panel.module.css';

export interface PanelHeaderProps {
  complex: ComplexDetail;
  /** Where the back arrow goes (the map without a selected complex). */
  backHref: string;
}

/** Panel head: back, crumb + name, 단지 정보 / 관심 단지 / 공유, and the one-line facts. */
export function PanelHeader({ complex, backHref }: PanelHeaderProps) {
  const favorite = useFavorite('complexes', complex.id, complex.name, { primary: true });
  const share = useShare();
  const crumb = [complex.emdName, complex.districtName, ASSET_TYPE_LABEL[complex.assetType]].filter(
    (s): s is string => !!s,
  );
  const facts = complexFacts(complex);

  return (
    <div className={styles.hd}>
      <div className={styles.title}>
        <Link className={styles.back} href={backHref} aria-label="단지 목록으로 돌아가기">
          <Icon name="chevron-left" size={22} />
        </Link>
        <div className={styles.tt}>
          <p className={styles.crumb}>
            {crumb.map((part, i) => (
              <Fragment key={part}>
                {i > 0 && <i aria-hidden="true" />}
                {part}
              </Fragment>
            ))}
          </p>
          <h1 className={styles.name} title={complex.name}>
            {complex.name}
          </h1>
        </div>
        <div className={styles.act}>
          <Link className={styles.vbtn} href={ROUTES.complex(complex.id)}>
            <Icon name="info" size={20} />
            단지 정보
          </Link>
          <button
            type="button"
            className={cx(styles.vbtn, favorite.on && styles.on)}
            aria-pressed={favorite.on}
            aria-busy={favorite.pending || undefined}
            onClick={favorite.toggle}
          >
            <Icon name="heart" size={20} filled={favorite.on} />
            관심 단지
          </button>
          <button
            type="button"
            className={styles.vbtn}
            onClick={() => void share({ title: complex.name, text: `${complex.name} 매물 보기` })}
          >
            <Icon name="share" size={20} />
            공유
          </button>
        </div>
      </div>
      {facts.length > 0 && (
        <dl className={styles.facts}>
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
