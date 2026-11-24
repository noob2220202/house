'use client';
import { Avatar, Badge, Icon, cx } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/config/nav';
import { isAgent, useSession, type SessionUser } from '@/lib/auth';
import { useUnreadNotificationCount } from '../api';
import { unreadBadge } from '../lib/notifications';
import { roleCaption } from '../lib/profile';
import { ME_NAV, ME_ROUTES, activeMeNavKey } from '../routes';
import { LinkPending } from './LinkPending';
import styles from './MeSideNav.module.css';

/** Desktop side navigation of /me: profile summary, section links, agent entry, logout. */
export function MeSideNav({ user: initialUser }: { user: SessionUser }) {
  const pathname = usePathname();
  const session = useSession();
  // The client session follows profile edits; fall back to the server-rendered user.
  const user = session.user ?? initialUser;
  const active = activeMeNavKey(pathname);
  const unread = unreadBadge(useUnreadNotificationCount().data);
  const agent = isAgent(user);

  return (
    <div className={styles.wrap}>
      <div className={styles.profile}>
        <Avatar name={user.nickname} size={52} tone="soft" />
        <div className={styles.who}>
          <p className={styles.name}>
            <span>{user.nickname}</span>님
          </p>
          <p className={styles.sub}>
            <Badge tone={agent ? 'brand' : 'neutral'}>{roleCaption(user.role)}</Badge>
          </p>
        </div>
        <Link href={ME_ROUTES.profile} className={styles.edit}>
          내 정보 수정
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>

      <nav aria-label="마이페이지" className={styles.nav}>
        {ME_NAV.map((item) => {
          const on = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cx(styles.item, on && styles.on)}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={item.icon} size={20} />
              <span className={styles.label}>{item.label}</span>
              <LinkPending />
              {item.key === 'notifications' && unread && (
                <span className={styles.count}>
                  {unread}
                  <span className="sr-only">개의 새 알림</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={styles.foot}>
        <Link href={agent ? ROUTES.agent : ROUTES.agentApply} className={styles.item}>
          <Icon name="store" size={20} />
          <span className={styles.label}>{agent ? '중개사 콘솔' : '중개사 회원 가입'}</span>
          <Icon name="chevron-right" size={16} className={styles.chev} />
        </Link>
        <button type="button" className={styles.item} onClick={() => void session.logout()}>
          <Icon name="logout" size={20} />
          <span className={styles.label}>로그아웃</span>
        </button>
      </div>
    </div>
  );
}
