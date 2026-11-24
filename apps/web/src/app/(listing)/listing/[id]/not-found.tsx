import type { Metadata } from 'next';
import { Button, EmptyState, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';

/** `<title>` of the 404 (otherwise the site default title would stay). */
export const metadata: Metadata = {
  title: '매물을 찾을 수 없어요',
  robots: { index: false, follow: false },
};

/** Listing gone (거래 완료 · 삭제 · 숨김) or never existed. Rendered inside the listing chrome with a 404 status. */
export default function ListingNotFound() {
  return (
    <div
      style={{ display: 'grid', placeItems: 'center', minHeight: '60dvh', padding: '24px 16px' }}
    >
      <EmptyState
        icon="home-search"
        title="매물을 찾을 수 없어요"
        description="거래가 끝났거나 중개사무소가 내린 매물일 수 있어요. 지도에서 지금 올라와 있는 매물을 확인해 보세요."
        action={
          <>
            <Button
              href={ROUTES.map('apt')}
              linkAs={Link}
              iconLeft={<Icon name="map-pin" size={18} />}
            >
              지도에서 찾기
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
