import type { Metadata } from 'next';
import { Button, EmptyState, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';

/** `<title>` of the 404 (otherwise the site default title would stay). */
export const metadata: Metadata = {
  title: '중개사무소를 찾을 수 없어요',
  robots: { index: false, follow: false },
};

export default function AgencyNotFound() {
  return (
    <div
      style={{ display: 'grid', placeItems: 'center', minHeight: '60dvh', padding: '24px 16px' }}
    >
      <EmptyState
        icon="store"
        title="중개사무소를 찾을 수 없어요"
        description="등록이 해지되었거나 주소가 바뀌었을 수 있어요. 중개사무소 찾기에서 다시 검색해 보세요."
        action={
          <>
            <Button
              href={ROUTES.agencies}
              linkAs={Link}
              iconLeft={<Icon name="search" size={18} />}
            >
              중개사무소 찾기
            </Button>
            <Button href={ROUTES.home} linkAs={Link} variant="secondary">
              홈으로
            </Button>
          </>
        }
      />
    </div>
  );
}
