import { Button, Icon } from '@house/ui';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { mainSiteUrl } from '../lib/host';
import styles from './OfficeSite.module.css';

/**
 * 404 of an office host. `site`: the address does not belong to a live office site (unknown,
 * waiting for approval, suspended) — no office chrome, a way to the main site. `missing`: the
 * [slug] boundary, used both for a missing page inside a live office (a listing that is gone or
 * belongs to another office; the office header above still leads home) and for a [slug] layout
 * that found no live site (Next renders this same boundary then). It must stay static — reading
 * the request there turns the ISR listing pages dynamic — so its copy and links fit both cases and
 * point at the main site (an office-home link would loop back here for a dead site).
 */
export function OfficeNotFound({ kind }: { kind: 'site' | 'missing' }) {
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
      <h1>페이지를 찾을 수 없어요</h1>
      <p>
        거래가 끝나 내려간 매물이거나, 주소가 바뀌었거나 지금은 운영하지 않는 홈페이지일 수 있어요.
        {` ${BRAND.name}`}에서 순천의 매물과 중개사무소를 찾아보세요.
      </p>
      <div className={styles.nfActs}>
        <Button href={mainSiteUrl(ROUTES.map())} iconLeft={<Icon name="search" size={18} />}>
          매물 찾기
        </Button>
        <Button href={mainSiteUrl(ROUTES.agencies)} variant="secondary">
          중개사무소 찾기
        </Button>
      </div>
    </div>
  );
}
