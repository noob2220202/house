'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

/** Error boundary inside the office-site chrome (header / footer stay visible). */
export default function OfficeSiteRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
