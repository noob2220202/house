import { HomePage } from '@/features/w-home';
import { buildMetadata } from '@/lib/seo';

// Home page (Main.dc.html / MobileHome.dc.html) — implemented by the w-home page group in
// src/features/w-home. Statically rendered and revalidated (ISR): each block caches its own API
// read (15–300 s), and the page is regenerated at most every 15 s, so an admin's banner change
// shows within seconds (= BANNER_REVALIDATE_SECONDS; segment config must be a literal).
export const revalidate = 15;

export const metadata = buildMetadata({ path: '/' });

export default function Page() {
  return <HomePage />;
}
