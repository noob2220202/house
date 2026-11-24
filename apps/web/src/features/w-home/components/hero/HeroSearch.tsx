'use client';
import { DealType } from '@house/shared';
import {
  Chip,
  Icon,
  SearchField,
  SegmentedControl,
  type ComboboxOption,
  useDebouncedValue,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { fetchSuggestions, homeKeys } from '../../api/client';
import type { Suggestion } from '../../api/schemas';
import { HERO_DEALS, QUICK_SEARCHES, type HeroDeal, type QuickSearch } from '../../config';
import { mapHref, searchHref } from '../../lib/links';
import styles from './Hero.module.css';

const PLACEHOLDER = '지역 또는 단지명 (예: 신대지구, 오천 그린빌)';
const PLACEHOLDER_SHORT = '지역 또는 단지명';
const SUGGEST_TYPES = new Set(['REGION', 'COMPLEX']);

/** Narrow viewports get the short placeholder (MobileHome). Starts with the long one for SSR. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}

export interface HeroSearchProps {
  /** Districts from `GET /home/summary` — used to aim the quick chips at the right map position. */
  regions: readonly { name: string; lat: number; lng: number }[];
}

/**
 * Hero search: deal pills → search field with 지역/단지명 autocomplete → "많이 찾는" quick chips.
 * A suggestion opens the map on the district / the complex page; a free-text submit goes to the
 * unified search results.
 */
export function HeroSearch({ regions }: HeroSearchProps) {
  const router = useRouter();
  const mobile = useIsMobile();
  const [deal, setDeal] = useState<HeroDeal>('all');
  const [q, setQ] = useState('');
  const term = useDebouncedValue(q.trim(), 180);

  const { data, isFetching } = useQuery({
    queryKey: homeKeys.suggest(term),
    queryFn: ({ signal }) => fetchSuggestions(term, signal),
    enabled: term.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const suggestions = useMemo(
    () => (term.length > 0 ? (data?.items ?? []).filter((s) => SUGGEST_TYPES.has(s.type)) : []),
    [data, term],
  );
  const options: ComboboxOption[] = useMemo(
    () =>
      suggestions.map((s) => ({
        value: `${s.type}:${s.id}`,
        label: s.label,
        description: s.description ?? undefined,
        leading: (
          <Icon
            name={s.type === 'REGION' ? 'map-pin' : 'building'}
            size={18}
            className={styles.optIcon}
          />
        ),
      })),
    [suggestions],
  );

  const go = (s: Suggestion) => {
    if (s.type === 'COMPLEX') {
      router.push(ROUTES.complex(s.id));
      return;
    }
    const center =
      typeof s.lat === 'number' && typeof s.lng === 'number' ? { lat: s.lat, lng: s.lng } : null;
    router.push(center ? mapHref('apt', { center, deal }) : searchHref(s.label, deal));
  };

  const quickHref = (c: QuickSearch) => {
    const region = regions.find((r) => r.name === c.region);
    // 분양권 only exists for apartments: the pill must not turn "순천대 원룸" into an empty map.
    const pill = deal === DealType.PRESALE && c.asset !== 'apt' ? 'all' : deal;
    return mapHref(c.asset, {
      center: region ? { lat: region.lat, lng: region.lng } : c.fallback,
      deal: c.deal ?? pill,
    });
  };

  return (
    <div className={styles.search}>
      <SegmentedControl
        className={styles.deals}
        variant="pills"
        label="거래 유형"
        options={HERO_DEALS}
        value={deal}
        onChange={setDeal}
      />
      <SearchField
        className={styles.field}
        variant="hero"
        label="지역 또는 단지명 검색"
        placeholder={mobile ? PLACEHOLDER_SHORT : PLACEHOLDER}
        value={q}
        onChange={setQ}
        options={options}
        loading={isFetching && term.length > 0 && options.length === 0}
        emptyText={
          term.length > 0 && !isFetching
            ? '일치하는 지역·단지가 없어요. 검색을 누르면 전체에서 찾아요.'
            : undefined
        }
        onSelect={(o) => {
          const picked = suggestions.find((s) => `${s.type}:${s.id}` === o.value);
          if (picked) go(picked);
        }}
        onSubmit={(value) => {
          const text = value.trim();
          router.push(text ? searchHref(text, deal) : mapHref('apt', { deal }));
        }}
      />
      <div className={styles.quick}>
        <span className={styles.quickLabel} id="hero-quick-l">
          많이 찾는
        </span>
        <ul className={styles.quickList} aria-labelledby="hero-quick-l">
          {QUICK_SEARCHES.map((c, i) => (
            <li
              key={c.label}
              className={c.mobileOnly ? 'only-sm' : c.desktopOnly ? 'only-lg' : undefined}
            >
              <Chip
                href={quickHref(c)}
                linkAs={Link}
                className={i === 0 ? `${styles.chip} ${styles.chipHot}` : styles.chip}
              >
                {c.label}
              </Chip>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
