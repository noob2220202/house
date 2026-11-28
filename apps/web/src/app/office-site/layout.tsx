import type { ReactNode } from 'react';

/**
 * Internal routes of the 사무소 홈페이지 (`https://<slug>.<root>/…` is rewritten here by the
 * middleware; on the main host these paths answer 404). Pass-through layout so that `notFound()`
 * thrown by `[slug]/layout.tsx` (unknown / not live site) lands in ./not-found.tsx.
 *
 * No loading.tsx anywhere below on purpose: a streamed shell would answer 200 for a missing site
 * or listing (soft 404). Pages resolve first, so unknown slugs and listings return a real 404.
 */
export default function OfficeSiteRootLayout({ children }: { children: ReactNode }) {
  return children;
}
