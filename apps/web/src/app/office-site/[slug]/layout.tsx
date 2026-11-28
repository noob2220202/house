import { agencySitePalette } from '@house/shared';
import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { loadOfficeSite } from '@/features/w-site/api/server';
import { OfficeSiteShell } from '@/features/w-site/components/OfficeSiteShell';

type Params = Promise<{ slug: string }>;

/** The browser chrome (mobile address bar) in the office's brand colour. */
export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { slug } = await params;
  const site = await loadOfficeSite(slug);
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: agencySitePalette(site?.color).brand,
  };
}

/** 사무소 홈페이지 chrome of `<slug>.<root>`; an unknown or not-live slug is a 404 (../not-found). */
export default async function OfficeSiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  const site = await loadOfficeSite(slug);
  if (!site) notFound();
  return <OfficeSiteShell site={site}>{children}</OfficeSiteShell>;
}
