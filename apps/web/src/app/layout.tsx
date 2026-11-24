import '@house/ui/styles.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers/Providers';
import { NoticePopupHost } from '@/features/w-home/popup';
import { BRAND } from '@/config/brand';
import { rootMetadata } from '@/lib/seo/metadata';

// The design's fonts: Inter (Latin, numerals, tnum) + Noto Sans KR (Hangul).
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-latin' });
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-kr',
  preload: false,
});

export const metadata: Metadata = rootMetadata;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${notoSansKr.variable}`}>
      <body>
        <Providers>
          {children}
          {/* Admin-managed notice popups for the current page (w-home). Renders nothing on the server. */}
          <NoticePopupHost />
        </Providers>
      </body>
    </html>
  );
}
