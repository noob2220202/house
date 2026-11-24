import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';

/**
 * Default site chrome (header, footer, mobile header + tab bar) for content pages.
 * Routes that need a different chrome live in their own route group with their own
 * <SiteShell …> (e.g. the map: no footer, full height) — see docs/FRONTEND.md.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
