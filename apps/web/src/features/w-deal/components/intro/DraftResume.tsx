'use client';
import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth';
import { clearDraft, draftKey, readDraft, type DraftKind } from '../../lib/draft';
import { FIND_DEFAULTS, FIND_STEPS } from '../../lib/find-form';
import { SELL_DEFAULTS, SELL_STEPS } from '../../lib/sell-form';
import styles from './intro.module.css';

interface DraftStatus {
  step: number;
  total: number;
}

/** Reads the signed-in user's autosaved draft (after mount — localStorage is client-only). */
function useDraftStatus(kind: DraftKind): [DraftStatus | null, () => void] {
  const { user } = useSession();
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }
    const draft =
      kind === 'sell'
        ? readDraft(draftKey(kind, userId), SELL_DEFAULTS)
        : readDraft(draftKey(kind, userId), FIND_DEFAULTS);
    const total = kind === 'sell' ? SELL_STEPS.length : FIND_STEPS.length;
    setStatus(draft ? { step: Math.min(draft.step + 1, total), total } : null);
  }, [kind, userId]);
  const discard = () => {
    if (userId) clearDraft(draftKey(kind, userId));
    setStatus(null);
  };
  return [status, discard];
}

/** "작성 중 · 2/4 단계" pill shown on a choice card when a draft exists. */
export function DraftPill({ kind }: { kind: DraftKind }) {
  const [status] = useDraftStatus(kind);
  if (!status) return null;
  return (
    <span className={styles.pill}>
      <Icon name="edit" size={14} />
      작성 중 · {status.step}/{status.total} 단계
    </span>
  );
}

export interface DraftCtaProps {
  kind: DraftKind;
  href: string;
  /** Label without a draft, e.g. "내놓기 시작하기". */
  label: string;
  variant: 'primary' | 'secondary';
}

/** Card call-to-action: "이어서 작성하기" (+ 새로 작성) when a draft exists, otherwise the start label. */
export function DraftCta({ kind, href, label, variant }: DraftCtaProps) {
  const [status, discard] = useDraftStatus(kind);
  return (
    <>
      <Button
        href={href}
        linkAs={Link}
        size="lg"
        variant={variant}
        iconRight={<Icon name="arrow-right" size={20} />}
      >
        {status ? '이어서 작성하기' : label}
      </Button>
      {status && (
        <button type="button" className={styles.restart} onClick={discard}>
          새로 작성
        </button>
      )}
    </>
  );
}
