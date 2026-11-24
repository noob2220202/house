import { Button, Chip, Icon, cx } from '@house/ui';
import Link from 'next/link';
import { PageHead } from '@/features/w-content/components/PageHead';
import { SupportTabs } from '@/features/w-content/components/SupportTabs';
import layout from '@/features/w-content/components/layout.module.css';
import { FAQ_CATEGORY_LABEL, FAQ_CATEGORY_ORDER } from '@/features/w-content/faq/faq-utils';
import { contactInfo } from '@/features/w-content/support/contact';
import styles from '@/features/w-content/support/support.module.css';
import { policyHref } from '@/features/w-content/terms/policies';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';
import { getPublicSiteSettings } from '@/lib/site/settings';

const DESCRIPTION =
  '서비스 이용 중 궁금한 점이나 불편한 점을 알려 주세요. 전화, 카카오톡, 이메일로 도와드려요.';

export const metadata = buildMetadata({
  title: '고객센터',
  description: DESCRIPTION,
  path: ROUTES.support,
});

// Contact details come from 사이트 설정 (cached 5 min by getPublicSiteSettings).
export const revalidate = 300;

/**
 * 고객센터 hub: contact channels from the back-office site settings, FAQ shortcuts, how to report a
 * false listing (#report — the report itself is filed from the listing page, it needs the listing id)
 * and 광고·제휴 문의 (#ads). `/support/report` and `/support/ads` redirect to those anchors.
 */
export default async function SupportPage() {
  const contact = contactInfo(await getPublicSiteSettings());
  const adMail = contact.email
    ? `${contact.email.href}?subject=${encodeURIComponent(`[광고 문의] ${BRAND.name}`)}`
    : null;

  return (
    <div className={`container ${layout.page}`}>
      <JsonLd data={breadcrumbJsonLd([{ name: '고객센터', path: ROUTES.support }])} />
      <PageHead
        title="고객센터"
        description={DESCRIPTION}
        crumbs={[{ label: '고객지원' }, { label: '고객센터' }]}
      />
      <div className={layout.tabs}>
        <SupportTabs current="support" />
      </div>

      <section className={layout.body} aria-labelledby="support-contact">
        <h2 id="support-contact" className="sr-only">
          문의하기
        </h2>
        <ul className={styles.contacts}>
          <li className={styles.contact}>
            <span className={styles.contactIcon} aria-hidden="true">
              <Icon name="phone" size={22} />
            </span>
            <span className={styles.contactLabel}>전화 상담</span>
            {contact.phone ? (
              <a className={styles.contactValue} href={contact.phone.href}>
                {contact.phone.display}
              </a>
            ) : (
              <span className={cx(styles.contactValue, styles.muted)}>번호를 준비하고 있어요</span>
            )}
            <span className={styles.contactNote}>
              {contact.hours ?? '운영 시간은 공지사항으로 알려 드려요.'}
            </span>
            {contact.phone && (
              <span className={styles.contactAction}>
                <Button
                  href={contact.phone.href}
                  variant="secondary"
                  size="sm"
                  iconLeft={<Icon name="phone" size={16} />}
                >
                  전화 걸기
                </Button>
              </span>
            )}
          </li>
          <li className={styles.contact}>
            <span className={styles.contactIcon} aria-hidden="true">
              <Icon name="chat" size={22} />
            </span>
            <span className={styles.contactLabel}>카카오톡 상담</span>
            <span
              className={cx(
                styles.contactValue,
                contact.kakaoChannelUrl ? styles.text : styles.muted,
              )}
            >
              {contact.kakaoChannelUrl ? '카카오톡 채널' : '채널을 준비하고 있어요'}
            </span>
            <span className={styles.contactNote}>
              채팅으로 편하게 물어보세요. 사진이나 화면 캡처도 함께 보낼 수 있어요.
            </span>
            {contact.kakaoChannelUrl && (
              <span className={styles.contactAction}>
                <Button
                  href={contact.kakaoChannelUrl}
                  target="_blank"
                  variant="secondary"
                  size="sm"
                  iconRight={<Icon name="external-link" size={16} />}
                >
                  채널 열기<span className="sr-only">(새 창)</span>
                </Button>
              </span>
            )}
          </li>
          <li className={styles.contact}>
            <span className={styles.contactIcon} aria-hidden="true">
              <Icon name="mail" size={22} />
            </span>
            <span className={styles.contactLabel}>이메일 문의</span>
            {contact.email ? (
              <a className={cx(styles.contactValue, styles.text)} href={contact.email.href}>
                {contact.email.display}
              </a>
            ) : (
              <span className={cx(styles.contactValue, styles.muted)}>주소를 준비하고 있어요</span>
            )}
            <span className={styles.contactNote}>
              화면을 캡처해 함께 보내 주시면 더 빨리 확인할 수 있어요.
            </span>
            {contact.email && (
              <span className={styles.contactAction}>
                <Button
                  href={contact.email.href}
                  variant="secondary"
                  size="sm"
                  iconLeft={<Icon name="mail" size={16} />}
                >
                  메일 보내기
                </Button>
              </span>
            )}
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="support-faq">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="support-faq" className="t-h3">
              자주 묻는 질문
            </h2>
            <p className={styles.sectionDesc}>문의하기 전에 분야별 답변을 먼저 찾아보세요.</p>
          </div>
          <Link href={ROUTES.faq} className={`link ${styles.more}`}>
            전체 보기
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        <div className={styles.chips}>
          {FAQ_CATEGORY_ORDER.map((category) => (
            <Chip
              key={category}
              variant="quick"
              href={`${ROUTES.faq}?category=${category}`}
              linkAs={Link}
            >
              {FAQ_CATEGORY_LABEL[category]}
            </Chip>
          ))}
        </div>
      </section>

      <div className={styles.panels}>
        <section id="report" className={styles.panel} aria-labelledby="support-report">
          <div className={styles.panelHead}>
            <span className={cx(styles.panelIcon, styles.danger)} aria-hidden="true">
              <Icon name="siren" size={20} />
            </span>
            <h2 id="support-report" className={styles.panelTitle}>
              허위매물 신고
            </h2>
          </div>
          <p className={styles.panelText}>
            신고는 해당 매물 화면에서 받아요. 어떤 매물인지 정확히 알아야 빠르게 확인할 수 있어요.
          </p>
          <ol className={styles.steps}>
            <li>지도나 목록에서 사실과 다른 매물을 엽니다.</li>
            <li>매물 화면의 &lsquo;허위매물 신고&rsquo;를 누르고 사유를 고릅니다. (로그인 필요)</li>
            <li>처리 결과는 MY &gt; 알림으로 알려 드려요.</li>
          </ol>
          <div className={styles.actions}>
            <Button
              href={ROUTES.map('apt')}
              linkAs={Link}
              size="sm"
              iconLeft={<Icon name="map-pin" size={16} />}
            >
              지도에서 매물 찾기
            </Button>
            <Button href={policyHref('false-listing')} linkAs={Link} size="sm" variant="secondary">
              신고 정책 보기
            </Button>
          </div>
        </section>

        <section id="ads" className={styles.panel} aria-labelledby="support-ads">
          <div className={styles.panelHead}>
            <span className={styles.panelIcon} aria-hidden="true">
              <Icon name="megaphone" size={20} />
            </span>
            <h2 id="support-ads" className={styles.panelTitle}>
              광고 · 제휴 문의
            </h2>
          </div>
          <p className={styles.panelText}>
            메인 배너, 지도 광고, 분양 홍보 같은 광고와 제휴 제안은 이메일로 보내 주세요. 회사 이름,
            연락처, 원하는 광고 위치와 기간을 적어 주시면 담당자가 확인하고 연락드려요.
          </p>
          <div className={styles.actions}>
            {adMail ? (
              <Button href={adMail} size="sm" iconLeft={<Icon name="mail" size={16} />}>
                광고 문의 메일 보내기
              </Button>
            ) : (
              <p className={styles.contactNote}>문의 메일 주소를 준비하고 있어요.</p>
            )}
            {contact.phone && (
              <Button href={contact.phone.href} size="sm" variant="secondary">
                전화 {contact.phone.display}
              </Button>
            )}
          </div>
        </section>
      </div>

      <aside className={styles.band} aria-label="중개사 회원 가입">
        <div>
          <p className={styles.bandTitle}>{BRAND.region}에서 중개사무소를 운영하세요?</p>
          <p className={styles.bandDesc}>
            중개사 회원으로 가입하면 매물을 올리고 다른 사무소와 공동중개할 수 있어요.
          </p>
        </div>
        <Button href={ROUTES.agentApply} linkAs={Link} variant="soft">
          중개사 회원 가입
        </Button>
      </aside>

      <nav className={styles.links} aria-label="더 알아보기">
        <Link href={ROUTES.notices} className={styles.linkCard}>
          <span className={styles.linkIcon} aria-hidden="true">
            <Icon name="megaphone" size={20} />
          </span>
          <span className={styles.linkText}>
            <b className={styles.linkTitle}>공지사항</b>
            <span className={styles.linkDesc}>서비스 소식과 점검 안내</span>
          </span>
          <Icon name="chevron-right" size={18} className={styles.linkGo} />
        </Link>
        <Link href={ROUTES.terms('service')} className={styles.linkCard}>
          <span className={styles.linkIcon} aria-hidden="true">
            <Icon name="document" size={20} />
          </span>
          <span className={styles.linkText}>
            <b className={styles.linkTitle}>약관 · 정책</b>
            <span className={styles.linkDesc}>이용약관, 개인정보처리방침</span>
          </span>
          <Icon name="chevron-right" size={18} className={styles.linkGo} />
        </Link>
        <Link href={ROUTES.tools} className={styles.linkCard}>
          <span className={styles.linkIcon} aria-hidden="true">
            <Icon name="calc" size={20} />
          </span>
          <span className={styles.linkText}>
            <b className={styles.linkTitle}>부동산 계산기</b>
            <span className={styles.linkDesc}>중개보수, 취득세, 대출 이자</span>
          </span>
          <Icon name="chevron-right" size={18} className={styles.linkGo} />
        </Link>
      </nav>
    </div>
  );
}
