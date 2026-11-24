import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';
import s from './layout.module.css';

/**
 * 중개사무소 찾기 is a full-height app screen like the map pages: header on top, the search panel
 * and the map fill the rest, no footer. On mobile the screen scrolls inside <main>. On desktop the
 * utility bar is hidden and the GNB spans the full width, as in the Agents design (same chrome as
 * the map screens).
 */
export default function AgenciesLayout({ children }: { children: ReactNode }) {
  return (
    <div className={s.chrome}>
      <SiteShell footer={false} fill>
        {children}
      </SiteShell>
    </div>
  );
}
