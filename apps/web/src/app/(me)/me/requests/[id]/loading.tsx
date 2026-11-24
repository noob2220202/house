import { Skeleton } from '@house/ui';
import { ROUTES } from '@/config/nav';
import { RequestListSkeleton } from '@/features/w-deal/components/requests/RequestCard';
import { MePage } from '@/features/w-me/components/MePage';

export default function MyRequestDetailLoading() {
  return (
    <MePage title="요청 상세" backHref={ROUTES.myRequests}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Skeleton height={220} radius={32} />
        <RequestListSkeleton rows={2} />
      </div>
    </MePage>
  );
}
