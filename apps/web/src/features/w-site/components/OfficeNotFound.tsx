import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { mainSiteUrl } from '../lib/host';
import { OFFICE_ROUTES } from '../lib/site';
import styles from './OfficeSite.module.css';

/**
 * 404 of an office host. `site`: the address does not belong to a live office site (unknown,
 * waiting for approval, suspended) — no office chrome, a way to the main site. `page`: a missing
 * page (a listing that is gone or belongs to another office) inside a live office site.
 */
export function OfficeNotFound({ kind }: { kind: 'site' | 'page' }) {
  if (kind === 'site') {
    return (
      <main id="main" className={styles.nf}>
        <span className={styles.nfIcon} aria-hidden="true">
          <Icon name="store" size={30} />
        </span>
        <h1>홈페이지를 찾을 수 없어요</h1>
        <p>
          주소가 바뀌었거나 지금은 운영하지 않는 중개사무소 홈페이지예요. {BRAND.name}에서 순천의
          중개사무소와 매물을 찾아보세요.
        </p>
        <div className={styles.nfActs}>
          <Button href={mainSiteUrl(ROUTES.agencies)} iconLeft={<Icon name="search" size={18} />}>
            중개사무소 찾기
          </Button>
          <Button href={mainSiteUrl('/')} variant="secondary">
            {BRAND.name} 홈
          </Button>
        </div>
      </main>
    );
  }
  return (
    <div className={styles.nf}>
      <span className={styles.nfIcon} aria-hidden="true">
        <Icon name="building" size={30} />
      </span>
      <h1>매물을 찾을 수 없어요</h1>
      <p>거래가 끝났거나 내려간 매물일 수 있어요. 사무소의 다른 매물을 둘러보세요.</p>
      <div className={styles.nfActs}>
        <Button href={OFFICE_ROUTES.listings} linkAs={Link}>
          매물 보러 가기
        </Button>
        <Button href={OFFICE_ROUTES.home} linkAs={Link} variant="secondary">
          사무소 홈
        </Button>
      </div>
    </div>
  );
}
