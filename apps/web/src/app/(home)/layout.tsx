import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';

/**
 * Home page route group (w-home): the default site chrome, but deliberately WITHOUT a
 * `loading.tsx`. A route-level loading boundary makes React ship a large page as "skeleton +
 * hidden segment + inline swap script" even when it is statically prerendered, which hides the
 * hero from non-JS crawlers and delays LCP until the whole document has arrived. Without the
 * boundary the ISR HTML carries the content in document order; client navigations to "/" use the
 * prefetched static payload.
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
