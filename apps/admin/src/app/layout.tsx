import '@house/ui/styles.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers/Providers';
import { BRAND } from '@/config/brand';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-latin' });
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-kr',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} ${BRAND.consoleLabel}`,
    template: `%s | ${BRAND.name} ${BRAND.consoleLabel}`,
  },
  description: `${BRAND.name} 운영 백오피스`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${notoSansKr.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
