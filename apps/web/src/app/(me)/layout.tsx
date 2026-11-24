import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';

/**
 * Chrome of the my-page group: the default site header/footer/tab bar, but every page draws its own
 * mobile top bar (title + back) through <MePage>, like the MobileListing sub pages.
 */
export default function MeGroupLayout({ children }: { children: ReactNode }) {
  return <SiteShell mobileHeader={false}>{children}</SiteShell>;
}
