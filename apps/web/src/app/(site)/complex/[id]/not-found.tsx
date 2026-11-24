import type { Metadata } from 'next';
import { Button, EmptyState } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';

/** `<title>` of the 404 (otherwise the site default title would stay). */
export const metadata: Metadata = {
  title: '단지를 찾을 수 없어요',
  robots: { index: false, follow: false },
};

export default function ComplexNotFound() {
  return (
    <div className="container" style={{ paddingBlock: 'var(--s-20)' }}>
      <EmptyState
        icon="building"
        title="단지를 찾을 수 없어요"
        description="삭제되었거나 주소가 잘못된 단지예요. 지도에서 다른 단지를 찾아보세요."
        action={
          <Button href={ROUTES.map('apt')} linkAs={Link}>
            아파트·분양권 지도 보기
          </Button>
        }
      />
    </div>
  );
}
