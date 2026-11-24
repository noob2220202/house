import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/config/nav';
import { StatusHeader, StatusPage } from '@/features/w-content/system/StatusPage';
import styles from '@/features/w-content/system/status.module.css';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS_INFO_PLACEHOLDER, getBusinessInfo } from '@/lib/site/settings';

export const metadata = buildMetadata({
  title: '서비스 점검 중',
  description: '더 안정적인 서비스를 위해 점검하고 있어요.',
  path: '/maintenance',
  noindex: true,
});

// Reads the maintenance window from the environment at request time.
export const dynamic = 'force-dynamic';

/**
 * Maintenance page. Stand-alone (no site chrome, no data needed to render) so the reverse proxy can
 * serve it for every path while the API is down — see docs/frontend-integration/w-content.md.
 * Optional env: MAINTENANCE_WINDOW ("11월 26일(목) 02:00 ~ 05:00"), MAINTENANCE_MESSAGE.
 */
export default async function MaintenancePage() {
  const window = process.env.MAINTENANCE_WINDOW?.trim();
  const message = process.env.MAINTENANCE_MESSAGE?.trim();
  // Never throws: falls back to placeholders when the API is unreachable (likely during maintenance).
  const business = await getBusinessInfo().catch(() => BUSINESS_INFO_PLACEHOLDER);
  const hasPhone = business.phone !== BUSINESS_INFO_PLACEHOLDER.phone;

  return (
    <>
      <StatusHeader>
        <Logo />
      </StatusHeader>
      <main>
        <StatusPage
          fullHeight
          icon="settings"
          title="더 나은 서비스를 위해 점검하고 있어요"
          description={
            message ||
            '점검하는 동안에는 매물 검색과 등록을 잠시 이용할 수 없어요. 조금만 기다려 주시면 곧 다시 열게요.'
          }
          actions={
            <Button href={ROUTES.home} linkAs={Link} iconLeft={<Icon name="refresh" size={18} />}>
              다시 접속하기
            </Button>
          }
          footnote="이용에 불편을 드려 죄송합니다."
        >
          <dl className={styles.box}>
            <div className={styles.boxRow}>
              <dt>점검 시간</dt>
              <dd>{window || '점검이 끝나는 대로 바로 열어요'}</dd>
            </div>
            <div className={styles.boxRow}>
              <dt>점검 내용</dt>
              <dd>서비스 안정화와 기능 개선</dd>
            </div>
            <div className={styles.boxRow}>
              <dt>고객센터</dt>
              <dd>
                {hasPhone ? (
                  <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} className="num">
                    {business.phone}
                  </a>
                ) : (
                  business.hours
                )}
              </dd>
            </div>
          </dl>
        </StatusPage>
      </main>
    </>
  );
}
