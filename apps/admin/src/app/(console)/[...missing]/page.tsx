import { notFound } from 'next/navigation';

/**
 * Unknown back-office paths 404 inside the shell (see ../not-found.tsx). Real routes take
 * precedence. This catch-all sits OUTSIDE the `(pages)` group on purpose: that group's
 * loading.tsx is a Suspense boundary, and a `notFound()` thrown under it is streamed after the
 * 200 status has been sent — out here it answers a real HTTP 404.
 */
export default function MissingPage() {
  notFound();
}
