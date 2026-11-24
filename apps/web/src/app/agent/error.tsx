'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

/** Error boundary inside the console shell (sidebar and topbar stay usable). */
export default function AgentRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
