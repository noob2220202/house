import type { Metadata } from 'next';
import { OfficeCssAnchor } from '@/features/w-site/components/OfficeCssAnchor';
import { OfficeNotFound } from '@/features/w-site/components/OfficeNotFound';

export const metadata: Metadata = {
  title: { absolute: '홈페이지를 찾을 수 없어요' },
  robots: { index: false, follow: false },
};

/** Office host whose slug has no live site (unknown, waiting for approval, suspended): 404. */
export default function OfficeSiteNotFound() {
  return (
    <>
      <OfficeCssAnchor />
      <OfficeNotFound kind="site" />
    </>
  );
}
