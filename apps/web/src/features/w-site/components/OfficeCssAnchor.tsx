'use client';
// Side-effect import on purpose — see the component comment.
import './OfficeSite.module.css';
import { Button, Icon } from '@house/ui';

/**
 * Renders nothing visible. Like `ChromeCssAnchor` (w-content/system) for the root 404: Next.js 15.5
 * links, for a not-found boundary, only the CSS reachable through client components, so the
 * office-site 404 (`app/office-site/not-found.tsx`, rendered without the office shell) would be
 * unstyled. Importing its module — and keeping `Button` / `Icon` in this client chunk — fixes that.
 */
export function OfficeCssAnchor() {
  return (
    <span
      hidden
      data-office-css={typeof Button === 'function' && typeof Icon === 'function' ? 'on' : 'off'}
    />
  );
}
