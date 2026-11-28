import { agencySiteCssVars } from '@house/shared';
import { BRAND } from '@/config/brand';
import type { OfficeContactAgency } from '../components/OfficeContactActions';
import type { OfficeSite } from '../api/schemas';

/**
 * Paths of an office's own site as the visitor sees them (`https://<slug>.<root>/…`; the middleware
 * rewrites them to app/office-site/[slug]/**). Relative on purpose: they stay on the office host.
 */
export const OFFICE_ROUTES = {
  home: '/',
  listings: '/#listings',
  about: '/#about',
  location: '/#location',
  listing: (id: string) => `/listing/${encodeURIComponent(id)}`,
} as const;

/** Header anchors of the office home. */
export const OFFICE_NAV = [
  { label: '매물', href: OFFICE_ROUTES.listings },
  { label: '사무소 소개', href: OFFICE_ROUTES.about },
  { label: '오시는 길', href: OFFICE_ROUTES.location },
] as const;

/** Canonical origin of the office home with a trailing slash ("https://sindae.suncheonmap.kr/"). */
export function officeHomeUrl(site: Pick<OfficeSite, 'url'>): string {
  return `${site.url.replace(/\/+$/, '')}/`;
}

/** "신대중앙 공인중개사사무소 | 순천 부동산" — the office's own brand first, no platform suffix. */
export function officeHomeTitle(name: string): string {
  return `${name} | ${BRAND.region.replace(/시$/, '')} 부동산`;
}

/**
 * `:root { --brand: …; … }` of the office's brand colour. Set on :root (not only on the shell) so
 * portalled layers — the 문의 dialog, toasts — wear the office colour too.
 */
export function officeBrandCss(color: string | null | undefined): string {
  const vars = Object.entries(agencySiteCssVars(color))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return `:root{${vars}}`;
}

/** The fields of the office the client contact island needs (nothing else crosses over). */
export function officeContactAgency(site: OfficeSite): OfficeContactAgency {
  const a = site.agency;
  return {
    id: a.id,
    name: a.name,
    phone: a.phone,
    logoUrl: a.logoUrl,
    representativeName: a.representativeName,
    registrationNumber: a.registrationNumber,
    roadAddress: a.roadAddress,
    addressDetail: a.addressDetail,
  };
}
