import { notFound } from 'next/navigation';

/**
 * Catch-all so unknown console paths render the in-shell 404 (`agent/not-found.tsx`) instead of
 * the site-wide one. Real routes (this group's and a-listings / a-inbox) always take precedence.
 */
export default function AgentCatchAll() {
  notFound();
}
