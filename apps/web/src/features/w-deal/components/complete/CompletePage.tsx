import { DealRequestType } from '@house/shared';
import { notFound, redirect } from 'next/navigation';
import { ROUTES } from '@/config/nav';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/server';
import { dealRequestDetailSchema } from '../../api/schemas';
import { CompleteView } from './CompleteView';

/**
 * Server body shared by /deal/sell/complete and /deal/find/complete (`?id=<request id>`).
 * Without an id the user goes to the request list; a request of the other type is redirected to
 * its own completion URL.
 */
export async function CompletePage({
  kind,
  id,
}: {
  kind: 'sell' | 'find';
  id: string | undefined;
}) {
  const base = kind === 'sell' ? ROUTES.dealSell : ROUTES.dealFind;
  if (!id) redirect(ROUTES.myRequests);
  await requireUser(`${base}/complete?id=${encodeURIComponent(id)}`);
  let request;
  try {
    request = await serverGetAuthed(`/me/deal-requests/${encodeURIComponent(id)}`, {
      schema: dealRequestDetailSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.isValidation)) notFound();
    throw error;
  }
  const actual = request.type === DealRequestType.SELL_OR_LEASE ? 'sell' : 'find';
  if (actual !== kind) {
    redirect(
      `${actual === 'sell' ? ROUTES.dealSell : ROUTES.dealFind}/complete?id=${encodeURIComponent(id)}`,
    );
  }
  return <CompleteView request={request} />;
}
