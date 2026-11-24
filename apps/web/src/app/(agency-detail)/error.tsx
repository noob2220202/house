'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

export default function AgencyRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
