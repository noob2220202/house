import { JsonLd, siteJsonLd } from '@/lib/seo';
import { getHomeData } from '../api/server';
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
 */
export async function HomePage() {
  const data = await getHomeData();
  const { summary } = data;
  // Mobile uses its own slot when the operator filled it, otherwise the main banners' mobile images.
  const hasMobileSlot = data.mobileBanners.length > 0;

  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <Hero summary={summary} featured={data.listings?.items[0]} />
      <CategoryGrid counts={summary?.assetTypeCounts} />

      {/* The carousels are the (named) regions — no extra "광고" landmark around them. The first
          slide loads eagerly where the carousel sits in the first mobile viewport (MobileHome LCP). */}
      {(data.heroBanners.length > 0 || hasMobileSlot) && (
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
      )}
      <DealQuick />
      <Band />

      <RankingSection initial={data.popular} />
      <Band />

      <NewListingsSection initial={data.listings} verifiedToday={summary?.verifiedTodayCount} />
      <DealBand />

      {data.stripBanners.length > 0 && (
        <div className={styles.strip}>
          <div className="container">
            <BannerCarousel banners={data.stripBanners} variant="strip" label="띠 광고" />
          </div>
        </div>
      )}

      {data.videos.length > 0 && <Band />}
      <VideosSection videos={data.videos} />

      {data.agencies.length > 0 && <Band />}
      <AgenciesSection agencies={data.agencies} total={summary?.agencyCount} />

      {data.app && <AppBand iosUrl={data.app.iosUrl} androidUrl={data.app.androidUrl} />}
    </>
  );
}
