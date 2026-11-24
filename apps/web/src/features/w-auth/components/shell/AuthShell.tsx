import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { getBusinessInfo } from '@/lib/site/settings';
import styles from './AuthShell.module.css';

/**
 * Chrome of the auth pages (login, OAuth landing, signup completion): no site header / tab bar —
 * just a skip link, the page and the minimal footer of Login.dc.html.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        본문 바로가기
      </a>
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <MiniFooter />
    </div>
  );
}

/** Slim top bar for auth pages that have no brand panel (signup, landing, farewell). */
export function AuthTopBar({ children }: { children?: ReactNode }) {
  return (
    <header className={styles.bar}>
      <div className={`container ${styles.barIn}`}>
        <Logo />
        {children && <div className={styles.barSide}>{children}</div>}
      </div>
    </header>
  );
}

const LEGAL: readonly { label: string; href: string; strong?: boolean }[] = [
  { label: '이용약관', href: ROUTES.terms('service') },
  { label: '개인정보처리방침', href: ROUTES.terms('privacy'), strong: true },
  { label: '위치기반서비스 이용약관', href: ROUTES.terms('location') },
  { label: '고객센터', href: ROUTES.support },
];

/**
 * Minimal footer: logo, legal links and 사업자 정보 from the admin site settings — the same
 * 전자상거래법 표시사항 as the site footer (통신판매업 신고번호 included).
 */
export async function MiniFooter() {
  const biz = await getBusinessInfo();
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(
    new Date(),
  );
  const items = [
    { label: '상호', value: biz.companyName },
    { label: '대표', value: biz.ceoName },
    { label: '사업자등록번호', value: biz.businessNumber },
    { label: '통신판매업 신고', value: biz.mailOrderNumber },
    { label: '주소', value: biz.address },
    { label: '개인정보보호책임자', value: biz.privacyOfficer },
    { label: '고객센터', value: biz.phone },
  ];
  return (
    <footer className={styles.foot}>
      <div className={`container ${styles.footIn}`}>
        <div className={styles.footRow}>
          <Logo size={28} />
          <nav className={styles.legal} aria-label="약관 및 정책">
            {LEGAL.map((l) => (
              <Link key={l.label} href={l.href} className={l.strong ? styles.strong : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <dl className={styles.biz}>
          {items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt> <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.copy}>
          © {year} {BRAND.name}
        </p>
      </div>
    </footer>
  );
}
