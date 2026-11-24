import { notFound } from 'next/navigation';

/** Unknown back-office paths 404 inside the shell (see ../not-found.tsx). Real routes take precedence. */
export default function MissingPage() {
  notFound();
}
