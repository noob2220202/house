'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

/** Error boundary inside the site chrome for the my-page group. */
export default function MeRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
