import { Button, EmptyState } from '@house/ui';
import Link from 'next/link';
import { AGENT_ROUTES } from '@/features/a-agency/nav';

/** In-shell 404 for unknown console paths. */
export default function AgentNotFound() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '56dvh' }}>
      <EmptyState
        icon="search"
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 아직 준비 중인 메뉴예요."
        action={
          <Button href={AGENT_ROUTES.dashboard} linkAs={Link}>
            대시보드로 이동
          </Button>
        }
      />
    </div>
  );
}
