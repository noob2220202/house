import { Breadcrumb } from '@house/ui';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import {
  DEAL_FAQ,
  DealFaq,
  DealHero,
  DealHowItWorks,
} from '@/features/w-deal/components/intro/DealIntro';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '내놓기 · 구하기',
  description: `집을 내놓을 때도, 구할 때도 한 번만 등록하면 ${BRAND.region} 공인중개사무소가 먼저 제안해요. 등록·이용 무료, 연락처는 동의한 중개사무소에만 공개됩니다.`,
  path: ROUTES.deal,
});

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: DEAL_FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

/** /deal — 내놓기 · 구하기 intro (public, SEO): hero with the two entry cards, how it works, FAQ. */
export default function DealIntroPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: '홈', path: ROUTES.home },
            { name: '내놓기 · 구하기', path: ROUTES.deal },
          ]),
          faqJsonLd,
        ]}
      />
      <DealHero
        crumb={
          <Breadcrumb
            linkAs={Link}
            items={[{ label: '홈', href: ROUTES.home }, { label: '내놓기 · 구하기' }]}
          />
        }
      />
      <DealHowItWorks />
      <DealFaq />
    </>
  );
}
