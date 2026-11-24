'use client';
import { ErrorPage, type ErrorPageProps } from '@/features/w-content/system/ErrorPage';

/** Root error boundary ("500"): routes outside a chrome layout land here, so it brings its own logo bar. */
export default function GlobalRouteError(props: Omit<ErrorPageProps, 'standalone'>) {
  return <ErrorPage {...props} standalone />;
}
