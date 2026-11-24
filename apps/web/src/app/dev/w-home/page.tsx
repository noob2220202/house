import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout';
import { AppBand } from '@/features/w-home/components/app/AppBand';

export const metadata: Metadata = {
  title: '홈 조건부 블록 (dev)',
  robots: { index: false, follow: false },
};

/**
 * Dev-only host for the home blocks that only render when the operator configured them — today
 * the app download band (`FEATURES.appBand` + `APP_LINKS` in the public site settings, both off in
 * the mock fixture). Lets the band be checked against Main.dc.html `.app`. 404 in production.
 */
export default function DevHomeBlocksPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <SiteShell>
      <AppBand
        iosUrl="https://apps.apple.com/kr/app/id0000000000"
        androidUrl="https://play.google.com/store/apps/details?id=kr.example.app"
      />
    </SiteShell>
  );
}
