import styles from './ProviderTile.module.css';
import { cx } from '../lib/cx';
import { GoogleMark, KakaoMark, NaverMark } from '../icons/BrandMarks';
import type { SocialProvider } from './SocialButton';

export interface ProviderTileProps {
  /** `kakao` · `naver` · `google` — the backend's `KAKAO` / `NAVER` / `GOOGLE` work too. */
  provider: SocialProvider | Uppercase<SocialProvider>;
  /** `sm` 20px and `md` 32px are round (inline rows); `lg` 44px is a rounded square (account rows). */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible name ("카카오 계정 연결됨"). Without it the tile is decorative. */
  label?: string;
  className?: string;
}

const MARK_SIZE = { sm: 12, md: 18, lg: 24 } as const;

/** A login provider's mark on its brand tile (카카오 yellow, 네이버 green, Google white). */
export function ProviderTile({ provider, size = 'md', label, className }: ProviderTileProps) {
  const p = provider.toLowerCase() as SocialProvider;
  const px = MARK_SIZE[size];
  return (
    <span
      className={cx(styles.tile, styles[size], styles[p], className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-provider={p}
    >
      {p === 'kakao' ? (
        <KakaoMark size={px} />
      ) : p === 'naver' ? (
        <NaverMark size={px} variant="white" />
      ) : (
        <GoogleMark size={px} />
      )}
    </span>
  );
}
