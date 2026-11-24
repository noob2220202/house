import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SiteShell } from '@/components/layout';
import { ComplexMapScreen } from '@/features/w-complex';

export const metadata: Metadata = {
  title: '단지 패널 (dev)',
  robots: { index: false, follow: false },
};

/**
 * Dev-only host of the complex panel (Complex.dc.html) — `/dev/w-complex?complex=<id | C01>`.
 * The production host is the map page (`/map/apt?complex=<id>`, page group w-map). 404 in production.
 */
export default function DevComplexPanelPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <SiteShell footer={false} mobileHeader={false} fill>
      <Suspense fallback={null}>
        <ComplexMapScreen />
      </Suspense>
    </SiteShell>
  );
}
