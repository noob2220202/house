'use client';
import { RouteError, type RouteErrorProps } from '@/components/system/RouteError';

/** Error boundary of the map screen (the header and tab bar stay usable). */
export default function MapRouteError(props: RouteErrorProps) {
  return <RouteError {...props} />;
}
