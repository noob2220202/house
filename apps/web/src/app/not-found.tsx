import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout';
import { ChromeCssAnchor } from '@/features/w-content/system/ChromeCssAnchor';
import { NotFoundBody } from '@/components/system/NotFoundBody';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
};

/**
 * Root 404 boundary (real 404 status): unmatched URLs and `notFound()` thrown by routes outside the
 * (site) group end up here, so it brings the site chrome itself. `notFound()` inside (site) routes
 * is rendered by `(site)/not-found.tsx` within the layout's chrome.
 */
export default function NotFound() {
  return (
    <SiteShell>
      <ChromeCssAnchor />
      <NotFoundBody />
    </SiteShell>
  );
}
