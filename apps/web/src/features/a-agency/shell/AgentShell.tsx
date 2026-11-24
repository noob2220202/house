'use client';
import { AGENCY_STATUS_LABEL, AgencyMemberRole, AgencyStatus, ROLE_LABEL } from '@house/shared';
import {
  AgencyLogo,
  Avatar,
  Button,
  Drawer,
  EmptyState,
  Icon,
  IconButton,
  Popover,
  cx,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/config/nav';
import { useUnreadNotificationCount } from '@/features/w-me/api';
import { isAgent, useSession, type SessionUser } from '@/lib/auth';
import { agencyKeys, fetchDashboard } from '../api/queries';
import {
  AGENT_ROUTES,
  AGENT_TAB_BAR,
  activeNavItem,
  findAgentNav,
  visibleAgentNav,
  type AgentBadgeCounts,
} from '../nav';
import styles from './AgentShell.module.css';

/** What the shell needs to know about the caller's agency (from GET /agencies/mine). */
export interface ShellAgency {
  id: string;
  name: string;
  status: AgencyStatus;
  myRole: AgencyMemberRole;
}

export interface AgentShellProps {
  /** Signed-in user, resolved on the server (the layout calls `requireUser`). */
  user: SessionUser;
  /** The user's agency, or null when they have not applied / joined yet. */
  agency: ShellAgency | null;
  children: ReactNode;
}

function statusDot(status: AgencyStatus): string | undefined {
  if (status === AgencyStatus.APPROVED) return undefined;
  return status === AgencyStatus.PENDING ? styles.warn : styles.danger;
}

interface NavListProps {
  agency: ShellAgency | null;
  isOwner: boolean;
  badges: AgentBadgeCounts;
  onNavigate?: () => void;
}

/** Brand row + office card + nav groups. Shared by the desktop sidebar and the mobile drawer. */
function NavList({ agency, isOwner, badges, onNavigate }: NavListProps) {
  const pathname = usePathname();
  const groups = visibleAgentNav(isOwner);
  const active = activeNavItem(
    pathname,
    groups.flatMap((g) => g.items),
  );
  return (
    <>
      <div className={styles.brandRow}>
        <Logo size={30} href={AGENT_ROUTES.dashboard} />
        <span className={styles.env}>중개사</span>
      </div>
      {agency && (
        <Link href={AGENT_ROUTES.profile} className={styles.office} onClick={onNavigate}>
          <AgencyLogo name={agency.name} seed={agency.id} size={36} fallback="initials" />
          <span className={styles.officeText}>
            <span className={styles.officeName}>{agency.name}</span>
            <span className={styles.officeMeta}>
              <i className={cx(styles.dot, statusDot(agency.status))} aria-hidden="true" />
              {AGENCY_STATUS_LABEL[agency.status]} · {isOwner ? '대표' : '소속 중개사'}
            </span>
          </span>
        </Link>
      )}
      {groups.map((group, gi) => {
        const headingId = group.title ? `agent-nav-${gi}` : undefined;
        return (
          <nav
            key={group.title ?? 'home'}
            className={styles.group}
            aria-labelledby={headingId}
            aria-label={headingId ? undefined : '홈'}
          >
            {group.title && (
              <p className={styles.groupTitle} id={headingId}>
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const on = item === active;
              const count = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(styles.item, on && styles.on)}
                  aria-current={on ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                  {!!count && (
                    <span className={cx(styles.badge, item.badgeWarn && styles.badgeWarn)}>
                      {count > 99 ? '99+' : count}
                      <span className="sr-only">건</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        );
      })}
      <div className={styles.sideFoot}>
        <Link href={ROUTES.home} className={styles.footLink} onClick={onNavigate}>
          <Icon name="external-link" size={18} />
          사이트로 돌아가기
        </Link>
        <Link href={ROUTES.support} className={styles.footLink} onClick={onNavigate}>
          <Icon name="info" size={18} />
          고객센터
        </Link>
      </div>
    </>
  );
}

function AccountMenu({ user }: { user: SessionUser }) {
  const { logout } = useSession();
  const name = user.name || user.nickname;
  return (
    <Popover
      placement="bottom-end"
      label="내 계정 메뉴"
      flush
      trigger={(p) => (
        <button type="button" className={styles.me} {...p} aria-label={`${name} 계정 메뉴`}>
          <Avatar name={name} size={36} />
          <span className={styles.meText}>
            <b>{name}</b>
            <span>{ROLE_LABEL[user.role]}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      )}
    >
      {(close) => (
        <div className={styles.menu}>
          <p className={styles.menuHead}>
            <b>{name}님</b>
            {ROLE_LABEL[user.role]}
          </p>
          <Link href={ROUTES.me} onClick={close}>
            <Icon name="user" size={18} />
            마이페이지
          </Link>
          <Link href={ROUTES.home} onClick={close}>
            <Icon name="home" size={18} />
            사이트 홈
          </Link>
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
  );
}

/** Topbar bell → the console's own notification centre (a-inbox), with the unread dot. */
function BellLink() {
  const unread = (useUnreadNotificationCount().data ?? 0) > 0;
  return (
    <span className={styles.bell}>
      <IconButton
        label={unread ? '알림, 새 알림 있음' : '알림'}
        href={AGENT_ROUTES.notifications}
        linkAs={Link}
        variant="plain"
      >
        <Icon name="bell" size={20} />
      </IconButton>
      {unread && <span className={styles.bellDot} aria-hidden="true" />}
    </span>
  );
}

/**
 * Broker console chrome for every route under /agent (shared with the a-listings and a-inbox
 * groups through `app/agent/layout.tsx`).
 *
 * - AGENT / AGENCY_OWNER: light sidebar (office card, nav groups with badges) + topbar + body,
 *   drawer and a 5-tab bottom bar on mobile.
 * - Any other signed-in user: a plain top bar; only `/agent/apply` renders, every other console
 *   path shows a "중개사 회원 전용" gate (the API enforces the role as well).
 */
export function AgentShell({ user, agency, children }: AgentShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  const router = useRouter();
  const consoleMode = isAgent(user);
  const onApply = pathname === AGENT_ROUTES.apply || pathname.startsWith(`${AGENT_ROUTES.apply}/`);
  // Non-agents only get the application page. Pages redirect on the server (`requireAgent`);
  // this covers console pages that forgot the guard and soft navigations.
  const gated = !consoleMode && !onApply;
  useEffect(() => {
    if (gated) router.replace(AGENT_ROUTES.apply);
  }, [gated, router]);
  const isOwner = agency ? agency.myRole === AgencyMemberRole.OWNER : user.role === 'AGENCY_OWNER';
  const approved = agency?.status === AgencyStatus.APPROVED;

  // Sidebar badges come from the dashboard aggregate (shared cache with the dashboard page).
  const { data: dashboard } = useQuery({
    queryKey: agencyKeys.dashboard,
    queryFn: ({ signal }) => fetchDashboard(signal),
    enabled: consoleMode && approved,
    staleTime: 60_000,
    retry: false,
  });
  const badges: AgentBadgeCounts = {
    newRequests: dashboard?.dealRequests.newCount,
    unreadInquiries: dashboard?.inquiries.unreadCount,
    verificationDue: dashboard?.verificationDue.length,
  };

  if (!consoleMode) {
    return (
      <div className={cx(styles.shell, styles.solo)}>
        <a href="#main" className={styles.skip}>
          본문 바로가기
        </a>
        <div className={styles.main}>
          <header className={styles.top}>
            <div className={styles.soloBrand}>
              <Logo size={30} />
              <span className={styles.env}>중개사 회원 가입</span>
            </div>
            <span className={styles.siteLink}>
              <Button variant="ghost" size="sm" href={ROUTES.home} linkAs={Link}>
                사이트로 돌아가기
              </Button>
            </span>
            <AccountMenu user={user} />
          </header>
          <main id="main" className={styles.body} tabIndex={-1}>
            {onApply ? (
              children
            ) : (
              <div className={styles.gate}>
                {/*
                  The page still renders (hidden) so its server guard runs during SSR:
                  `requireAgent()` then answers with a real 307 to /agent/apply instead of a
                  streamed client redirect. Unguarded pages stay hidden behind this gate.
                */}
                <div hidden>{children}</div>
                <EmptyState
                  icon="lock"
                  title="중개사 회원 전용 메뉴예요"
                  description="중개사무소 등록을 신청하고 승인을 받으면 매물 등록과 요청 관리를 시작할 수 있어요."
                  action={
                    <Button href={AGENT_ROUTES.apply} linkAs={Link}>
                      중개사 회원 신청하기
                    </Button>
                  }
                />
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  const nav = findAgentNav(pathname);
  const tabActive = activeNavItem(pathname, AGENT_TAB_BAR);
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        본문 바로가기
      </a>
      <aside className={styles.side} aria-label="중개사 콘솔 메뉴">
        <NavList agency={agency} isOwner={isOwner} badges={badges} />
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <IconButton
            className={styles.menuBtn}
            label="메뉴 열기"
            variant="plain"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={22} />
          </IconButton>
          <p className={styles.crumb}>
            {nav ? (
              <>
                <span className={styles.crumbPrefix}>
                  <span>중개사 콘솔</span>
                  {nav.group && (
                    <>
                      <i aria-hidden="true" />
                      <span>{nav.group}</span>
                    </>
                  )}
                  <i aria-hidden="true" />
                </span>
                <b>{nav.item.label}</b>
              </>
            ) : (
              <b>중개사 콘솔</b>
            )}
          </p>
          <span className={styles.quick}>
            <Button
              size="sm"
              href={AGENT_ROUTES.listingNew}
              linkAs={Link}
              iconLeft={<Icon name="plus" size={16} />}
            >
              매물 등록
            </Button>
          </span>
          {agency && approved && (
            <span className={styles.siteLink}>
              <Button
                variant="secondary"
                size="sm"
                href={ROUTES.agency(agency.id)}
                target="_blank"
                rel="noopener"
                iconLeft={<Icon name="external-link" size={16} />}
              >
                내 사무소 페이지
              </Button>
            </span>
          )}
          <BellLink />
          <span className={styles.sep} aria-hidden="true" />
          <AccountMenu user={user} />
        </header>
        <main id="main" className={styles.body} tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className={styles.tabbar} aria-label="중개사 콘솔 하단 메뉴">
        {AGENT_TAB_BAR.map((tab) => {
          const on = tab === tabActive;
          const count = tab.badgeKey ? badges[tab.badgeKey] : undefined;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(styles.tab, on && styles.on)}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={tab.icon} size={24} />
              {tab.label}
              {!!count && (
                <span className={styles.tabDot}>
                  {count > 9 ? '9+' : count}
                  <span className="sr-only">건</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        side="left"
        title="중개사 콘솔 메뉴"
        width={288}
        flush
      >
        <div className={styles.drawerNav}>
          <NavList
            agency={agency}
            isOwner={isOwner}
            badges={badges}
            onNavigate={() => setMenuOpen(false)}
          />
        </div>
      </Drawer>
    </div>
  );
}
