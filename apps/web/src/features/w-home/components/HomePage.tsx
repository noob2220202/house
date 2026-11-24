import { HomeSectionKey } from '@house/shared';
import { Fragment, type ReactNode } from 'react';
import { JsonLd, siteJsonLd } from '@/lib/seo';
import { getHomeData } from '../api/server';
import { isSectionVisible } from '../lib/home-layout';
import { AgenciesSection } from './agencies/AgenciesSection';
import { BannerCarousel } from './ads/BannerCarousel';
import { AppBand } from './app/AppBand';
import { CategoryGrid } from './categories/CategoryGrid';
import { DealBand } from './deal/DealBand';
import { DealQuick } from './deal/DealQuick';
import { Hero } from './hero/Hero';
import { NewListingsSection } from './listings/NewListingsSection';
import { RankingSection } from './ranking/RankingSection';
import { VideosSection } from './videos/VideosSection';
import styles from './HomePage.module.css';

/** Grey 10px separator between the mobile home sections (MobileHome `.mh-band`). */
const Band = () => <div className={styles.band} aria-hidden="true" />;

/**
 * Home page (Main.dc.html / MobileHome.dc.html). Server component: everything above the fold and
 * all SEO content is rendered on the server from cached API reads; the ranking tabs, the listing
 * filter, the banner carousel and the search field hydrate as small client islands.
 *
 * Section order and visibility follow HOME_LAYOUT (admin "메인 화면 편집", D9). Two blocks ride
 * along with a section's slot: the mobile 내놓기/구하기 pair sits right under the banner slot (it
 * belongs to 내놓기·구하기 안내), and the strip banner after the 내놓기·구하기 slot (it belongs to
 * 메인 배너). The home has no notice block (공지 lives at /notices), so NOTICES renders nothing.
 */
export async function HomePage() {
  const data = await getHomeData();
  const { summary, layout } = data;
  const visible = (key: HomeSectionKey) => isSectionVisible(layout, key);
  // Mobile uses its own slot when the operator filled it, otherwise the main banners' mobile images.
  const hasMobileSlot = data.mobileBanners.length > 0;

  const render = (key: HomeSectionKey): ReactNode => {
    switch (key) {
      case HomeSectionKey.HERO_SEARCH:
        return <Hero summary={summary} featured={data.listings?.items[0]} />;
      case HomeSectionKey.CATEGORY_TILES:
        return <CategoryGrid counts={summary?.assetTypeCounts} />;
      case HomeSectionKey.MAIN_BANNER:
        // The carousels are the (named) regions — no extra "광고" landmark around them. The first
        // slide loads eagerly where the carousel sits in the first mobile viewport (MobileHome LCP).
        return data.heroBanners.length > 0 || hasMobileSlot ? (
          <div className={styles.ads}>
            <div className="container">
              {data.heroBanners.length > 0 && (
                <BannerCarousel
                  banners={data.heroBanners}
                  label="메인 광고"
                  eager={!hasMobileSlot}
                  className={hasMobileSlot ? 'only-lg' : undefined}
                />
              )}
              {hasMobileSlot && (
                <BannerCarousel
                  banners={data.mobileBanners}
                  label="메인 광고"
                  eager
                  className="only-sm"
                />
              )}
            </div>
          </div>
        ) : null;
      case HomeSectionKey.POPULAR_COMPLEXES:
        return (
          <>
            <Band />
            <RankingSection initial={data.popular} />
          </>
        );
      case HomeSectionKey.NEW_LISTINGS:
        return (
          <>
            <Band />
            <NewListingsSection
              initial={data.listings}
              verifiedToday={summary?.verifiedTodayCount}
            />
          </>
        );
      case HomeSectionKey.DEAL_REQUEST_CTA:
        return <DealBand />;
      case HomeSectionKey.LOCAL_VIDEOS:
        return data.videos.length > 0 ? (
          <>
            <Band />
            <VideosSection videos={data.videos} />
          </>
        ) : null;
      case HomeSectionKey.FEATURED_AGENCIES:
        return data.agencies.length > 0 ? (
          <>
            <Band />
            <AgenciesSection agencies={data.agencies} total={summary?.agencyCount} />
          </>
        ) : null;
      case HomeSectionKey.APP_BAND:
        // APP_LINKS: no store link → no band.
        return data.app ? (
          <AppBand iosUrl={data.app.iosUrl} androidUrl={data.app.androidUrl} />
        ) : null;
      default:
        return null;
    }
  };

  /** Blocks anchored after a section's slot, whether that section is shown or not. */
  const after = (key: HomeSectionKey): ReactNode => {
    if (key === HomeSectionKey.MAIN_BANNER && visible(HomeSectionKey.DEAL_REQUEST_CTA)) {
      return <DealQuick />;
    }
    if (
      key === HomeSectionKey.DEAL_REQUEST_CTA &&
      visible(HomeSectionKey.MAIN_BANNER) &&
      data.stripBanners.length > 0
    ) {
      return (
        <div className={styles.strip}>
          <div className="container">
            <BannerCarousel banners={data.stripBanners} variant="strip" label="띠 광고" />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <JsonLd data={siteJsonLd()} />
      {layout.map((section) => (
        <Fragment key={section.key}>
          {section.visible && render(section.key)}
          {after(section.key)}
        </Fragment>
      ))}
    </>
  );
}
