'use client';
import { ErrorPage, type ErrorPageProps } from '@/features/w-content/system/ErrorPage';

/** Error boundary of the home page, inside the site chrome (same body as the other site pages). */
export default function HomeRouteError(props: Omit<ErrorPageProps, 'standalone'>) {
  return <ErrorPage {...props} />;
}
