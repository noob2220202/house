import type { ReactNode } from 'react';
import { dashboardSummarySchema } from '@/features/m-core/api/schemas';
import { ConsoleShell } from '@/features/m-core/components/shell/ConsoleShell';
import { SessionRedirect } from '@/features/m-core/components/shell/SessionRedirect';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { getServerAdmin } from '@/lib/auth/server';
import { AdminSessionProvider } from '@/lib/auth/session';

/**
 * Authenticated back-office area. Every page below renders inside the admin shell and is guarded
 * server-side (session + TOTP). The shell counters (sidebar badges, bell, social-login status) are
 * fetched here once for the first paint and kept fresh on the client by <ConsoleShell>.
 *
 * The middleware already sent cookie-less requests to /login (with `returnTo`). Getting here
 * without a valid session means the cookie outlived the session (idle timeout, revocation, TOTP
 * reset): <SessionRedirect> sends the admin to /login with this page as `returnTo` — a server
 * redirect from a layout could not, it does not know the requested path. Role checks stay with
 * the pages (`requireAdmin(path, minRole)`); every admin role may open the console itself.
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  // Both requests carry the same cookie: run them side by side instead of one after the other.
  const [admin, summary] = await Promise.all([
    getServerAdmin(),
    serverGetAuthed('/admin/dashboard', { schema: dashboardSummarySchema }).catch(
      (error: unknown) => {
        if (error instanceof ApiError) return null; // the shell still renders; the client retries
        throw error;
      },
    ),
  ]);
  if (!admin?.mfaVerified) return <SessionRedirect />;
  return (
    <AdminSessionProvider initialAdmin={admin}>
      <ConsoleShell initialSummary={summary}>{children}</ConsoleShell>
    </AdminSessionProvider>
  );
}
