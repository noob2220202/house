import { AGENT_ROUTES } from '@/features/a-agency/nav';

/** Routes owned by a-listings that are not in the shared console nav. */
export const CO_BROKER_ROUTE = `${AGENT_ROUTES.listings}/co-broker`;

/** /agent/listings/:id/edit?step=<key> */
export const editStepHref = (id: string, step: string) =>
  `${AGENT_ROUTES.listingEdit(id)}?step=${step}`;
