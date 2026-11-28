import type { Metadata } from 'next';
import { OfficeCssAnchor } from '@/features/w-site/components/OfficeCssAnchor';
import { OfficeNotFound } from '@/features/w-site/components/OfficeNotFound';

export const metadata: Metadata = {
  title: { absolute: '매물을 찾을 수 없어요' },
  robots: { index: false, follow: false },
};

/** A missing page inside a live office site (listing gone or of another office): 404 in its chrome. */
export default function OfficePageNotFound() {
  return (
    <>
      <OfficeCssAnchor />
      <OfficeNotFound kind="page" />
    </>
  );
}
