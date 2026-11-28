'use client';
import { Button, Icon, Modal, useToast } from '@house/ui';
import { useEffect, useState } from 'react';
import { BRAND } from '@/config/brand';
import { absoluteUrl } from '@/lib/seo';
import { ROUTES } from '@/config/nav';
import type { ListingDetail } from '../api/schemas';
import { listingFullTitle } from '../lib/view';
import styles from './dialogs.module.css';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * 공유: copy link, and the native share sheet when the browser has one (KakaoTalk is one of its
 * targets on phones). A dedicated "카카오톡으로 보내기" button comes back with the Kakao share SDK;
 * until then it is left out rather than shown as a button that only says "준비 중".
 */
export function ShareDialog({
  listing,
  open,
  onClose,
}: {
  listing: ListingDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const title = listingFullTitle(listing);
  // The canonical URL (no tracking / intent params). Uses the live origin so staging links work too.
  const [url, setUrl] = useState(() => absoluteUrl(ROUTES.listing(listing.id)));
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}${ROUTES.listing(listing.id)}`);
    setCanNativeShare(typeof navigator.share === 'function');
  }, [listing.id]);

  const copy = async () => {
    const ok = await copyText(url);
    toast(
      ok
        ? { message: '링크를 복사했어요.' }
        : { message: '복사하지 못했어요. 주소를 길게 눌러 직접 복사해 주세요.', tone: 'error' },
    );
    if (ok) onClose();
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: `${title} | ${BRAND.name}`, url });
      onClose();
    } catch {
      // cancelled by the user
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="매물 공유하기" description={title}>
      <div className={styles.shareLink}>
        <label className="sr-only" htmlFor="share-url">
          매물 주소
        </label>
        <input
          id="share-url"
          className={styles.shareInput}
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button size="sm" onClick={() => void copy()} iconLeft={<Icon name="copy" size={16} />}>
          복사
        </Button>
      </div>
      {canNativeShare && (
        <div className={styles.shareActions}>
          <Button
            variant="secondary"
            block
            onClick={() => void nativeShare()}
            iconLeft={<Icon name="share" size={18} />}
          >
            다른 앱으로 공유
          </Button>
        </div>
      )}
    </Modal>
  );
}
