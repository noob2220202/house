import type { Metadata } from 'next';
import { OfficeCssAnchor } from '@/features/w-site/components/OfficeCssAnchor';
import { OfficeNotFound } from '@/features/w-site/components/OfficeNotFound';

export const metadata: Metadata = {
  title: { absolute: '페이지를 찾을 수 없어요' },
  robots: { index: false, follow: false },
};

/**
 * 404 under an office host: a missing page inside a live office, and also the [slug] layout's own
 * notFound() for a host without a live site (Next renders this boundary for both). Static on
 * purpose — reading the request here would turn the ISR office pages dynamic (500 at runtime).
 */
export default function OfficePageNotFound() {
  return (
    <>
      <OfficeCssAnchor />
      <OfficeNotFound kind="missing" />
    </>
  );
}
