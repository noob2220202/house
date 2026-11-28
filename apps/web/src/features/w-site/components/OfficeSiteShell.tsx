import { AgencyLogo } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND, josa } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { displayPhone, fullAddress, telHref } from '@/features/w-agencies/lib/agency';
import { getBusinessInfo } from '@/lib/site/settings';
import type { OfficeSite } from '../api/schemas';
import { mainSiteUrl } from '../lib/host';
import { OFFICE_NAV, OFFICE_ROUTES, officeBrandCss, officeContactAgency } from '../lib/site';
import { OfficeContactActions } from './OfficeContactActions';
import styles from './OfficeSite.module.css';

export interface OfficeSiteShellProps {
  site: OfficeSite;
  children: ReactNode;
}

/**
 * Chrome of an office's own site (`https://<slug>.<root>`): the office's logo, name and brand colour
 * instead of the platform's — no login, no 내놓기 / 구하기, no tab bar (visitors are anonymous on an
 * office host; everything signed-in lives on the main site). The footer carries the office's
 * 공인중개사법 표시 items and the platform's business line.
 */
export function OfficeSiteShell({ site, children }: OfficeSiteShellProps) {
  return (
    <div className={styles.shell}>
      {/* Brand colour on :root, so portalled dialogs and toasts wear it too (fixed palette values). */}
      <style dangerouslySetInnerHTML={{ __html: officeBrandCss(site.color) }} />
      <a href="#main" className={styles.skip}>
        본문 바로가기
      </a>
      <OfficeHeader site={site} />
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <OfficeFooter site={site} />
    </div>
  );
}

/** Logo (or initials) of the office. */
export function OfficeLogo({
  site,
  size,
  className,
}: {
  site: OfficeSite;
  size: number;
  className?: string;
}) {
  const a = site.agency;
  return (
    <AgencyLogo
      className={className}
      name={a.name}
      seed={a.id}
      size={size}
      fallback="initials"
      image={
        a.logoUrl ? (
          <Image
            src={a.logoUrl}
            alt=""
            fill
            sizes={`${size}px`}
            unoptimized={a.logoUrl.startsWith('/mock-api/')}
          />
        ) : undefined
      }
    />
  );
}

function OfficeHeader({ site }: { site: OfficeSite }) {
  const a = site.agency;
  const contact = officeContactAgency(site);
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href={OFFICE_ROUTES.home} className={styles.brand} aria-label={`${a.name} 홈`}>
          <OfficeLogo site={site} size={40} className={styles.brandLogo} />
          <span className={styles.brandName}>{a.name}</span>
        </Link>
        <nav className={styles.nav} aria-label="사무소 홈페이지 메뉴">
          {OFFICE_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>
        <OfficeContactActions agency={contact} variant="header" className={styles.headerActs} />
        <OfficeContactActions agency={contact} variant="icon" className={styles.headerCall} />
      </div>
      <nav className={styles.mNav} aria-label="사무소 홈페이지 메뉴 (모바일)">
        {OFFICE_NAV.map((item) => (
          <Link key={item.href} href={item.href} className={styles.mNavLink}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

async function OfficeFooter({ site }: { site: OfficeSite }) {
  const a = site.agency;
  const biz = await getBusinessInfo();
  const tel = telHref(a.phone);
  const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(
    new Date(),
  );
  // 공인중개사법 제18조의2 표시 items of the office (명칭 · 소재지 · 연락처 · 등록번호 · 대표자).
  const office = [
    { label: '상호', value: a.name },
    { label: '대표', value: `${a.representativeName} (개업공인중개사)` },
    { label: '중개사무소 등록번호', value: a.registrationNumber, num: true },
    { label: '소재지', value: fullAddress(a) },
  ];
  const platform = [
    biz.companyName,
    `대표 ${biz.ceoName}`,
    `사업자등록번호 ${biz.businessNumber}`,
    `통신판매업 신고 ${biz.mailOrderNumber}`,
    biz.address,
  ];
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footOffice}>
          <p className={styles.footName}>{a.name}</p>
          <dl className={styles.footDl}>
            {office.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.num ? 'num' : undefined}>{row.value}</dd>
              </div>
            ))}
            <div>
              <dt>대표번호</dt>
              <dd className="num">{tel ? <a href={tel}>{displayPhone(a.phone)}</a> : a.phone}</dd>
            </div>
          </dl>
        </div>
        <div className={styles.footPlatform}>
          <p className={styles.poweredBy}>
            이 홈페이지는{' '}
            <a href={mainSiteUrl('/')} className={styles.poweredLink}>
              {BRAND.name}
            </a>
            {josa(BRAND.name, '이', '가').slice(BRAND.name.length)} 제공해요
          </p>
          <nav className={styles.footLegal} aria-label="약관 및 정책">
            <a href={mainSiteUrl(ROUTES.terms('service'))}>이용약관</a>
            <a href={mainSiteUrl(ROUTES.terms('privacy'))}>
              <b>개인정보처리방침</b>
            </a>
            <a href={mainSiteUrl(ROUTES.agency(a.id))}>{BRAND.name}에서 사무소 보기</a>
          </nav>
          <p className={styles.footBiz}>
            {platform.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
          <p className={styles.footCopy}>
            매물 정보는 {josa(a.name, '이', '가')} 등록하며, {josa(BRAND.name, '은', '는')}{' '}
            통신판매중개자로서 거래 당사자가 아닙니다. © {year} {BRAND.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
