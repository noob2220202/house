'use client';
import { AdBadge, AgencyLogo, Button, Icon, Skeleton, cx } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useRef } from 'react';
import { ROUTES } from '@/config/nav';
import { bannerClickHref } from '@/lib/ads';
import { useAdImpression } from '@/lib/ads/client';
import { complexKeys, featuredBannersQuery, fetchComplexAgencies } from '../api/queries';
import type { Banner, ComplexAgency } from '../api/schemas';
import styles from './panel.module.css';

/**
 * Text of the card, resolved from the banner, the office embedded in it (if any) and the office's
 * stats inside this complex (`GET /complexes/:id/agencies`).
 */
export function featuredCardText(banner: Banner, agency: ComplexAgency | undefined) {
  const name = agency?.name ?? banner.agency?.name ?? banner.advertiserName ?? banner.title;
  const kicker = agency?.specialtyLabel ?? (banner.title !== name ? banner.title : null);
  const ceo = agency?.representativeName ?? banner.agency?.representativeName;
  const count = agency?.complexListingCount ?? banner.agency?.complexListingCount ?? 0;
  const response = agency?.avgResponseMinutes ?? banner.agency?.avgResponseMinutes ?? null;
  const meta = [
    ceo ? `대표 ${ceo}` : '',
    count > 0 ? `이 단지 매물 ${count}건` : '',
    response !== null ? `평균 응답 ${response}분` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { name, kicker, meta };
}

/** Where 문의 goes: the tracked click redirect when the banner has a link, else the office page. */
export function featuredCardHref(banner: Banner): string | null {
  if (banner.linkUrl) return bannerClickHref(banner.id);
  return banner.agencyId ? ROUTES.agency(banner.agencyId) : null;
}

export interface FeaturedAgencyCardProps {
  complexId: string;
  /** Server-fetched banners of the slot (SEO page) — the card then renders without a loading gap. */
  initialBanners?: Banner[];
  /** Server-fetched offices of the complex (SEO page) — the card text is then complete on first paint. */
  initialAgencies?: ComplexAgency[];
  className?: string;
}

/**
 * COMPLEX_FEATURED_AGENCY ad slot: the office promoted for this complex (admin-managed banner).
 * Renders nothing when no banner is live. Always labelled "AD"; the impression is reported once
 * when the card scrolls into view and the click goes through the click-redirect endpoint.
 */
export function FeaturedAgencyCard({
  complexId,
  initialBanners,
  initialAgencies,
  className,
}: FeaturedAgencyCardProps) {
  const { data: banners, isPending } = useQuery({
    ...featuredBannersQuery(complexId),
    initialData: initialBanners,
  });
  const banner = banners?.[0];
  const { data: agencies, isLoading: agenciesLoading } = useQuery({
    queryKey: complexKeys.agencies(complexId),
    queryFn: ({ signal }) => fetchComplexAgencies(complexId, signal),
    enabled: !!banner?.agencyId,
    initialData: initialAgencies,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const ref = useRef<HTMLElement>(null);
  // Counted once the finished card (not its loading placeholder) is half on screen.
  useAdImpression(ref, banner?.id, { enabled: !isPending && !agenciesLoading });

  // Hold the slot's space (same size as the card) until its text is complete, so nothing jumps.
  if (isPending || agenciesLoading)
    return (
      <div className={cx(styles.feat, styles.featLoading, className)} aria-hidden="true">
        <Skeleton width={44} height={44} radius="var(--r-md)" />
      </div>
    );
  if (!banner) return null;
  const agency = agencies?.find((a) => a.agencyId === banner.agencyId);
  const { name, kicker, meta } = featuredCardText(banner, agency);
  const href = featuredCardHref(banner);
  const logoUrl = agency?.logoUrl ?? banner.agency?.logoUrl;

  return (
    <aside ref={ref} className={cx(styles.feat, className)} aria-label="광고">
      <AgencyLogo
        name={name}
        seed={banner.agencyId ?? banner.id}
        size={44}
        image={logoUrl ? <Image src={logoUrl} alt="" fill sizes="44px" /> : undefined}
      />
      <span className={styles.featT}>
        <span className={styles.featK}>
          <AdBadge onDark />
          {kicker && (
            <>
              <Icon name="star" size={14} />
              {kicker}
            </>
          )}
        </span>
        <b className={styles.featN}>{name}</b>
        {meta && <span className={styles.featM}>{meta}</span>}
      </span>
      {href && (
        <Button
          href={href}
          className={styles.featBtn}
          iconLeft={<Icon name="phone" size={18} />}
          target={banner.newWindow ? '_blank' : undefined}
          rel={banner.newWindow ? 'sponsored noopener noreferrer' : 'sponsored'}
          aria-label={`${name}에 문의`}
        >
          문의
        </Button>
      )}
    </aside>
  );
}
