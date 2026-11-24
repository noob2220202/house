'use client';
// Side-effect imports on purpose — see the component comment.
import '@/components/layout/MobileTabBar.module.css';
import '@/components/layout/SiteFooter.module.css';
import '@/components/layout/SiteHeader.module.css';
import '@/components/layout/SiteShell.module.css';
import { Logo } from '@house/ui';

/**
 * Renders nothing visible. It exists so the ROOT `not-found.tsx` gets the stylesheets of the site
 * chrome.
 *
 * Next.js (15.5) links, for the special `/_not-found` entry, only the CSS reachable through client
 * components (and the root layout). CSS Modules imported by nested SERVER components — SiteShell,
 * SiteFooter and the `@house/ui` Logo — are left out, so the 404 chrome rendered unstyled (dev: the
 * whole footer; production: the logo lockup). Importing those modules from this client component
 * puts them in the not-found entry's client CSS, which is always linked. Regular routes are not
 * affected (their layouts already load the same files; class names are identical).
 *
 * Remove this file once the framework links server-component CSS for not-found boundaries.
 */
export function ChromeCssAnchor() {
  // Referencing Logo keeps its module (and Logo.module.css) in this client chunk.
  return <span hidden data-chrome-css={typeof Logo === 'function' ? 'on' : 'off'} />;
}
