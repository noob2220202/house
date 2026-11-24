import { Button, EmptyState } from '@house/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24 }}>
      <EmptyState
        icon="compass"
        title="페이지를 찾을 수 없어요"
        description="주소가 바뀌었거나 권한이 없는 화면일 수 있어요."
        action={
          <Button href="/" linkAs={Link}>
            대시보드로
          </Button>
        }
      />
    </main>
  );
}
