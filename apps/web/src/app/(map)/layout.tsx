import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';
import s from './layout.module.css';

/**
 * Map chrome: full-height app screen — no footer, no mobile top bar (the map draws its own floating
 * search), bottom tab bar on mobile. On desktop the utility bar is hidden and the GNB spans the
 * full width, like the MapApt / OneRoom designs.
 */
export default function MapLayout({ children }: { children: ReactNode }) {
  return (
    <div className={s.mapChrome}>
      <SiteShell footer={false} mobileHeader={false} fill>
        {children}
      </SiteShell>
    </div>
  );
}
