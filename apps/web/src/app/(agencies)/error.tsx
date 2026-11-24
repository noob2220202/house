'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

export default function AgenciesRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
