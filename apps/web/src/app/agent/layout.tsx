import { UserRole } from '@house/shared';
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { agencyKeys, fetchStaffAgency } from '@/features/a-agency/api/queries';
import { myAgencySchema, type MyAgency } from '@/features/a-agency/api/schemas';
import { AgentShell, AgentSignedOut, ConsoleUserProvider } from '@/features/a-agency/shell';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { getServerSession } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: { default: '중개사 콘솔', template: '%s | 중개사 콘솔' },
  robots: { index: false, follow: false },
};

type AgencyLoad =
  | { kind: 'ok'; agency: MyAgency | null }
  | { kind: 'missing' }
  | { kind: 'forbidden' }
  | { kind: 'error' };

/**
 * GET /agencies/mine on the server (`200 null` = none). 404 / 403 are decided once the role is
 * known: a USER has no agency yet, an AGENT falls back to the membership (B2).
 */
async function loadAgency(): Promise<AgencyLoad> {
  try {
    const agency = await serverGetAuthed('/agencies/mine', { schema: myAgencySchema.nullable() });
    return { kind: 'ok', agency };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.isNotFound) return { kind: 'missing' };
    if (error.isForbidden) return { kind: 'forbidden' };
    return { kind: 'error' };
  }
}

/** Staff whose `/agencies/mine` failed: membership + public profile (null on any API error). */
async function loadStaffAgency(): Promise<MyAgency | null | undefined> {
  try {
    return await fetchStaffAgency((path, schema) => serverGetAuthed(path, { schema }));
  } catch (error) {
    if (error instanceof ApiError) return undefined;
    throw error;
  }
}

/**
 * Broker console layout for every route under /agent (this group's pages plus a-listings and
 * a-inbox).
 *
 * The layout does NOT redirect: each page guards itself (`requireAgent(<its own path>)`, or
 * `requireUser` on /agent/apply), so an expired session returns to the exact deep link. Layout and
 * page render in one pass without a Suspense boundary, so a page's redirect is still a real 307.
 * If a page forgot its guard, `AgentSignedOut` hides it behind a sign-in prompt.
 *
 * The agency fetched here seeds the client cache (`agencyKeys.mine`) → dashboard, profile and
 * apply render without a skeleton or a second request.
 *
 * There is deliberately no `agent/loading.tsx`: a segment-level Suspense boundary would start
 * streaming (HTTP 200) before the page's guard runs, turning its redirect into a client-side one.
 */
export default async function AgentLayout({ children }: { children: ReactNode }) {
  // Independent requests → in parallel.
  const [user, load] = await Promise.all([getServerSession(), loadAgency()]);
  if (!user || user.signupCompleted === false) {
    return (
      <ConsoleUserProvider user={null}>
        <AgentSignedOut>{children}</AgentSignedOut>
      </ConsoleUserProvider>
    );
  }

  // 404 = no agency; for a USER (applicant / not applied yet) a 403 means the same — the
  // application form must still render. An AGENT is resolved from the membership instead.
  const failed = load.kind === 'missing' || load.kind === 'forbidden';
  const agency: MyAgency | null | undefined =
    load.kind === 'ok'
      ? load.agency
      : failed && user.role === UserRole.AGENT
        ? await loadStaffAgency()
        : load.kind === 'missing' || (load.kind === 'forbidden' && user.role === UserRole.USER)
          ? null
          : undefined;

  const queryClient = new QueryClient();
  if (agency !== undefined) queryClient.setQueryData(agencyKeys.mine, agency);

  return (
    <ConsoleUserProvider user={user}>
      <AgentShell
        user={user}
        agency={
          agency
            ? { id: agency.id, name: agency.name, status: agency.status, myRole: agency.myRole }
            : null
        }
      >
        <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>
      </AgentShell>
    </ConsoleUserProvider>
  );
}
