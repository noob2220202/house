'use client';
import { Icon, useToast } from '@house/ui';
import { ROUTES } from '@/config/nav';
import { useFavorite } from '@/lib/favorites/useFavorite';
import styles from './ProfileActions.module.css';

export interface ProfileActionsProps {
  agencyId: string;
  agencyName: string;
  className?: string;
}

/** 관심 pill — the shared favourites module (signed-out users log in and come back with it added). */
function FavoriteAgencyButton({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const fav = useFavorite('agencies', agencyId, agencyName, { primary: true });
  return (
    <button
      type="button"
      className={styles.act}
      aria-pressed={fav.on}
      aria-label={fav.label}
      onClick={fav.toggle}
    >
      <Icon name="heart" size={16} filled={fav.on} />
      관심
    </button>
  );
}

/** 관심 + 공유 pills of the office profile (`.od-act`). */
export function ProfileActions({ agencyId, agencyName, className }: ProfileActionsProps) {
  const { toast } = useToast();

  const onShare = async () => {
    const url = new URL(ROUTES.agency(agencyId), window.location.origin).toString();
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: agencyName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ message: '링크를 복사했어요.', tone: 'success' });
    } catch (error) {
      // The user closing the share sheet is not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ message: '링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.', tone: 'error' });
    }
  };

  return (
    <div className={className ? `${styles.acts} ${className}` : styles.acts}>
      {/* `PUT|DELETE /me/favorites/agencies/:id` (home module, frontend contract). */}
      <FavoriteAgencyButton agencyId={agencyId} agencyName={agencyName} />
      <button
        type="button"
        className={styles.act}
        aria-label={`${agencyName} 공유`}
        onClick={() => void onShare()}
      >
        <Icon name="share" size={16} />
        공유
      </button>
    </div>
  );
}
