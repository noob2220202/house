import { Icon } from '@house/ui';
import Link from 'next/link';
import { BRAND, josa } from '@/config/brand';
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/config/nav';
import { Logo } from '@/components/brand/Logo';
import { getBusinessInfo, type BusinessInfo } from '@/lib/site/settings';
import styles from './SiteFooter.module.css';

function bizItems(b: BusinessInfo): { label: string; value: string }[] {
  return [
    { label: '상호', value: b.companyName },
    { label: '대표', value: b.ceoName },
    { label: '사업자등록번호', value: b.businessNumber },
    { label: '통신판매업 신고', value: b.mailOrderNumber },
    { label: '주소', value: b.address },
    { label: '개인정보보호책임자', value: b.privacyOfficer },
    { label: '이메일', value: b.email },
    { label: '호스팅서비스 제공', value: b.hostingProvider },
  ];
}

/**
 * Site footer per design: sitemap columns + legal links + 사업자 정보 from admin site settings
 * (전자상거래법 표시사항). Desktop = full footer, mobile (≤ 720px) = compact footer with a
 * collapsible business-info block (MobileHome).
 */
export async function SiteFooter() {
  const biz = await getBusinessInfo();
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(
    new Date(),
  );
  const disclaimer = `매물 정보는 각 중개사무소가 등록하며, ${josa(BRAND.name, '은', '는')} 통신판매중개자로서 거래 당사자가 아닙니다. © ${year} ${BRAND.name}`;
  return (
    <footer className={styles.footer}>
      {/* Desktop */}
      <div className={`container ${styles.desktop}`}>
        <div className={styles.top}>
          <div className={styles.about}>
            <Logo />
            <p className="t-sm">{BRAND.description}</p>
            <p className="t-sm">
              <b className={styles.strong}>고객센터 {biz.phone}</b>
              <br />
              {biz.hours}
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className={styles.colTitle}>{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className={styles.colLink}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <hr className="divider" />
        <nav className={styles.legal} aria-label="약관 및 정책">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className={l.strong ? styles.strong : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <dl className={styles.biz}>
          {bizItems(biz).map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt> <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.copy}>{disclaimer}</p>
      </div>

      {/* Mobile */}
      <div className={styles.mobile}>
        <nav className={styles.mLegal} aria-label="약관 및 정책">
          {LEGAL_LINKS.filter((l) => l.mobile).map((l) => (
            <Link key={l.label} href={l.href} className={l.strong ? styles.strong : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <details className={styles.mBiz}>
          <summary>
            {biz.companyName} 사업자 정보
            <Icon name="chevron-down" size={18} />
          </summary>
          <dl>
            {bizItems(biz)
              .slice(1)
              .map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt> <dd>{item.value}</dd>
                </div>
              ))}
          </dl>
        </details>
        <p className={styles.mCopy}>
          고객센터 {biz.phone} · {biz.hours.split(' · ')[0]}
          <br />
          {disclaimer}
        </p>
      </div>
    </footer>
  );
}
