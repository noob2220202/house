import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';

/**
 * Listing detail chrome: desktop header + footer, but no mobile top bar (the gallery carries the
 * back / share / 관심 buttons, per MobileListing) and no bottom tab bar (the page has its own sticky
 * 문의 bar).
 */
export default function ListingLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell mobileHeader={false} tabBar={false}>
      {children}
    </SiteShell>
  );
}
