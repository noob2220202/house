import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';
import { ROUTES } from '@/config/nav';

/**
 * Agency page chrome: like the listing detail, the mobile bottom tab bar is replaced by the page's
 * own sticky 문의하기 / 전화 bar, and the mobile top bar gets a back link to the office search.
 */
export default function AgencyDetailLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell tabBar={false} mobileHeader={{ backHref: ROUTES.agencies, bordered: true }}>
      {children}
    </SiteShell>
  );
}
