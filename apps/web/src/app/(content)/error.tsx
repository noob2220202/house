'use client';
import { ErrorPage, type ErrorPageProps } from '@/features/w-content/system/ErrorPage';

/** Error boundary inside the site chrome (header/footer stay visible). */
export default function ContentRouteError(props: Omit<ErrorPageProps, 'standalone'>) {
  return <ErrorPage {...props} />;
}
