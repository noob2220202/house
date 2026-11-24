import { PageSkeleton } from '@/components/system/PageSkeleton';

/**
 * Skeleton of the 내놓기 · 구하기 pages while their server check runs. Scoped to /deal on purpose:
 * a group-level `(site)/loading.tsx` would also wrap /complex/[id] and turn its `notFound()` into
 * a soft 404 (the 200 status is sent with the streamed skeleton).
 */
export default function DealLoading() {
  return <PageSkeleton />;
}
