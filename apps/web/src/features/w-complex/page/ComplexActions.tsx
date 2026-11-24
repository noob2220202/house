'use client';
import { Button, Icon, cx } from '@house/ui';
import { useFavorite } from '@/lib/favorites/useFavorite';
import { useShare } from '../hooks/useShare';
import styles from './page.module.css';

/** 관심 단지 toggle + 공유 — the two secondary actions of the summary card. */
export function ComplexActions({ complexId, name }: { complexId: string; name: string }) {
  const favorite = useFavorite('complexes', complexId, name, { primary: true });
  const share = useShare();
  return (
    <div className={styles.actRow}>
      <Button
        variant="secondary"
        aria-pressed={favorite.on}
        className={cx(favorite.on && styles.liked)}
        iconLeft={<Icon name="heart" size={18} filled={favorite.on} />}
        onClick={favorite.toggle}
      >
        관심 단지
      </Button>
      <Button
        variant="secondary"
        iconLeft={<Icon name="share" size={18} />}
        onClick={() => void share({ title: name, text: `${name} 실거래가·매물` })}
      >
        공유
      </Button>
    </div>
  );
}
