import { ROUTES } from '@/config/nav';
import { RequestListSkeleton } from '@/features/w-deal/components/requests/RequestCard';
import { MePage } from '@/features/w-me/components/MePage';

export default function MyRequestsLoading() {
  return (
    <MePage title="내놓기·구하기 요청" mobileTitle="내 요청" backHref={ROUTES.me}>
      <RequestListSkeleton />
    </MePage>
  );
}
