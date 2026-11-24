'use client';
import { Avatar, Icon, Popover, Skeleton } from '@house/ui';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ROUTES } from '@/config/nav';
import { loginUrl } from '@/lib/auth/routes';
import { useSession } from '@/lib/auth/session';
import styles from './SiteHeader.module.css';

function LoginLink() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Come back to the current page after login (never back to the login page itself).
  const here =
    pathname.startsWith('/login') || pathname.startsWith('/auth')
      ? undefined
      : `${pathname}${search ? `?${search}` : ''}`;
  return (
    <Link className={styles.login} href={loginUrl(here)}>
      로그인
    </Link>
  );
}

/** Header right slot: 로그인 pill when signed out, account menu when signed in. Width is reserved to avoid layout shift. */
export function HeaderAuth() {
  const { user, status, isAgent, logout } = useSession();
  if (status === 'loading') {
    return (
      <span className={styles.authSlot} aria-hidden="true">
        <Skeleton width={78} height={44} radius={999} />
      </span>
    );
  }
  if (!user) {
    return (
      <span className={styles.authSlot}>
        <Suspense
          fallback={
            <Link className={styles.login} href="/login">
              로그인
            </Link>
          }
        >
          <LoginLink />
        </Suspense>
      </span>
    );
  }
  return (
    <span className={styles.authSlot}>
      <Popover
        placement="bottom-end"
        label="내 계정 메뉴"
        flush
        trigger={(p) => (
          <button type="button" className={styles.me} {...p}>
            <Avatar name={user.nickname} size={36} />
            <span className={styles.meName}>{user.nickname}</span>
            <Icon name="chevron-down" size={16} />
          </button>
        )}
      >
        {(close) => (
          <div className={styles.menu}>
            <p className={styles.menuHead}>
              <b>{user.nickname}님</b>
              {isAgent ? '중개사 회원' : '일반 회원'}
            </p>
            <Link href={ROUTES.me} onClick={close}>
              <Icon name="user" size={18} />
              마이페이지
            </Link>
            <Link href={ROUTES.favorites} onClick={close}>
              <Icon name="heart" size={18} />
              관심 매물·단지
            </Link>
            <Link href={ROUTES.myRequests} onClick={close}>
              <Icon name="home-up" size={18} />
              내놓기·구하기 요청
            </Link>
            {isAgent && (
              <Link href={ROUTES.agent} onClick={close}>
                <Icon name="store" size={18} />
                중개사 콘솔
              </Link>
            )}
            <hr />
            <button
              type="button"
              onClick={() => {
                close();
                void logout();
              }}
            >
              <Icon name="logout" size={18} />
              로그아웃
            </button>
          </div>
        )}
      </Popover>
    </span>
  );
}
