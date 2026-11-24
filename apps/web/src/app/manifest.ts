import type { MetadataRoute } from 'next';
import { BRAND } from '@/config/brand';

/** Web app manifest ("홈 화면에 추가"). Icons are rendered from design/brand/mark.svg. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: 'ko',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: BRAND.themeColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
