import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Gallery } from './Gallery';

export const metadata: Metadata = {
  title: 'UI 갤러리 (dev)',
  robots: { index: false, follow: false },
};

/** Dev-only component gallery for visual QA against DesignSystem.dc.html. 404 in production. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery />;
}
