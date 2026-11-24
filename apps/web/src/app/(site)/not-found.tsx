import type { Metadata } from 'next';
import { NotFoundBody } from '@/components/system/NotFoundBody';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: { index: false, follow: false },
};

/** 404 inside the site chrome (the (site) layout already renders header, footer and tab bar). */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
