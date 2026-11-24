import type { ReactNode } from 'react';
import styles from './SocialButton.module.css';
import { cx } from '../lib/cx';
import { GoogleMark, KakaoMark, NaverMark } from '../icons/BrandMarks';

export type SocialProvider = 'kakao' | 'naver' | 'google';

const LABEL: Record<SocialProvider, string> = {
  kakao: '카카오로 3초 만에 시작하기',
  naver: '네이버로 시작하기',
  google: 'Google로 시작하기',
};
const NAME: Record<SocialProvider, string> = { kakao: '카카오', naver: '네이버', google: 'Google' };

export interface SocialButtonProps {
  provider: SocialProvider;
  /** OAuth start URL — always a full-page navigation (plain <a>). */
  href: string;
  /** Round 52px icon-only variant. */
  round?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Social login button following each provider's colour rule. 카카오 / 네이버 / Google only. */
export function SocialButton({ provider, href, round, children, className }: SocialButtonProps) {
  const mark =
    provider === 'kakao' ? (
      <KakaoMark size={round ? 24 : 22} />
    ) : provider === 'naver' ? (
      <NaverMark size={round ? 24 : 22} variant={round ? 'white' : 'tile'} />
    ) : (
      <GoogleMark size={round ? 24 : 22} />
    );
  return (
    <a
      href={href}
      className={cx(styles.sns, styles[provider], round && styles.round, className)}
      aria-label={round ? `${NAME[provider]}로 로그인` : undefined}
    >
      {mark}
      {!round && (children ?? LABEL[provider])}
    </a>
  );
}
