'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

export default function AuthRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
