import { Button, Chip, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { SiteSearch } from '@/features/w-content/search/SiteSearch';
import { StatusPage } from '@/features/w-content/system/StatusPage';
import styles from '@/features/w-content/system/status.module.css';

const QUICK_LINKS = [
  { label: '아파트·분양권', href: ROUTES.map('apt') },
  { label: '원룸·투룸', href: ROUTES.map('oneroom') },
  { label: '중개사무소 찾기', href: ROUTES.agencies },
  { label: '내놓기 · 구하기', href: ROUTES.deal },
  { label: '공지사항', href: ROUTES.notices },
];

/**
 * Generic 404 body (numerals, help, search, quick links) — rendered inside whatever chrome the
 * boundary has. Neutral wording: it also answers missing notices, requests and other pages; the
 * listing, complex and agency routes keep their own resource-specific not-found pages.
 */
export function NotFoundBody() {
  return (
    <StatusPage
      code="404"
      title="페이지를 찾을 수 없어요"
      description="주소가 바뀌었거나 삭제된 페이지예요. 아래에서 다시 찾아보세요."
      actions={
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
    >
      <div className={styles.search}>
        <SiteSearch variant="pill" placeholder="지역, 단지, 중개사무소 검색" />
      </div>
      <nav className={styles.links} aria-label="자주 찾는 메뉴">
        {QUICK_LINKS.map((link) => (
          <Chip key={link.href} href={link.href} linkAs={Link}>
            {link.label}
          </Chip>
        ))}
      </nav>
    </StatusPage>
  );
}
