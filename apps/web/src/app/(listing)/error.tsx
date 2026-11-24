'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

/** Error boundary inside the listing chrome (header / footer stay visible). */
export default function ListingRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
