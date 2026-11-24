import { HomePage } from '@/features/w-home';
import { buildMetadata } from '@/lib/seo';

// Home page (Main.dc.html / MobileHome.dc.html) — implemented by the w-home page group in
// src/features/w-home. Statically rendered and revalidated (ISR): each block caches its own API
// read (60–300 s), and the page itself is regenerated at most once a minute.
export const revalidate = 60;

export const metadata = buildMetadata({ path: '/' });

export default function Page() {
  return <HomePage />;
}
