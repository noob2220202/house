'use client';
import {
  Icon,
  SearchField,
  type ComboboxOption,
  type IconName,
  useDebouncedValue,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { contentKeys, fetchSearchSuggestions } from '../api/client';
import type { SearchSuggestionType } from '../api/schemas';
import { SEARCH_MAX_LENGTH, SUGGESTION_TYPE_LABEL, suggestionHref } from './targets';
import styles from './search.module.css';

export interface SiteSearchProps {
  /** `hero` = 64px search with a 검색 button (home hero, /search); `pill` = 44px header pill. */
  variant?: 'hero' | 'pill';
  initialQuery?: string;
  placeholder?: string;
  /** Focus the input on mount (the /search landing reached from the mobile header icon). */
  autoFocus?: boolean;
  /**
   * Offer the popular keywords while the input is empty (default). Pass false where the page already
   * shows them (the /search landing chips): the list then opens only once the visitor types.
   */
  showPopular?: boolean;
  className?: string;
}

const TYPE_ICON: Record<SearchSuggestionType, IconName> = {
  REGION: 'map-pin',
  COMPLEX: 'building',
  AGENCY: 'store',
};
const KEYWORD_PREFIX = 'kw:';

/**
 * Site-wide search field with autocomplete (지역 · 단지 · 중개사무소). Choosing a suggestion goes
 * straight to the map / complex / agency page; Enter or 검색 opens the unified results (/search?q=).
 * With an empty input the list offers the popular keywords.
 *
 * Drop-in for any header or hero: `<SiteSearch variant="pill" />`.
 */
export function SiteSearch({
  variant = 'hero',
  initialQuery = '',
  placeholder = '지역 또는 단지명 (예: 신대지구, 연향동)',
  autoFocus,
  showPopular = true,
  className,
}: SiteSearchProps) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(initialQuery);
  const term = useDebouncedValue(value.trim().slice(0, SEARCH_MAX_LENGTH), 180);

  // Keep the field in sync when the page navigates to another query (back/forward, chips).
  useEffect(() => setValue(initialQuery), [initialQuery]);
  useEffect(() => {
    if (autoFocus) document.getElementById(inputId)?.focus({ preventScroll: true });
  }, [autoFocus, inputId]);

  const { data, isFetching, isError } = useQuery({
    queryKey: contentKeys.suggest(term),
    queryFn: ({ signal }) => fetchSearchSuggestions(term, signal),
    staleTime: 60_000,
    // The empty-input request only feeds the popular keywords.
    enabled: term !== '' || showPopular,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const typing = value.trim() !== '';
  const { options, hrefByValue } = useMemo(() => {
    const hrefs = new Map<string, string>();
    if (!typing) {
      if (!showPopular) return { options: [], hrefByValue: hrefs };
      const popular: ComboboxOption[] = (data?.popular ?? []).map((keyword) => ({
        value: `${KEYWORD_PREFIX}${keyword}`,
        label: keyword,
        leading: <Icon name="search" size={18} />,
      }));
      return { options: popular, hrefByValue: hrefs };
    }
    const items: ComboboxOption[] = (data?.items ?? []).map((s) => {
      const key = `${s.type}:${s.id}`;
      hrefs.set(key, suggestionHref(s));
      return {
        value: key,
        label: s.label,
        description: [SUGGESTION_TYPE_LABEL[s.type], s.description].filter(Boolean).join(' · '),
        leading: <Icon name={TYPE_ICON[s.type]} size={18} />,
      };
    });
    return { options: items, hrefByValue: hrefs };
  }, [data, typing, showPopular]);

  const submit = (raw: string) => {
    const q = raw.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH);
    if (q === '') return;
    router.push(ROUTES.search(q));
  };

  return (
    <SearchField
      id={inputId}
      variant={variant}
      label="지역, 단지, 중개사무소 검색"
      value={value}
      onChange={setValue}
      onSubmit={submit}
      placeholder={placeholder}
      options={options}
      onSelect={(option) => {
        if (option.value.startsWith(KEYWORD_PREFIX)) {
          setValue(option.label);
          submit(option.label);
          return;
        }
        const href = hrefByValue.get(option.value);
        if (href) router.push(href);
      }}
      loading={typing && isFetching && options.length === 0}
      emptyText={
        isError
          ? '추천 검색어를 불러오지 못했어요. Enter로 검색해 보세요.'
          : '일치하는 추천이 없어요. Enter로 전체 결과를 확인해 보세요.'
      }
      listHeader={
        !typing && options.length > 0 ? (
          <p className={styles.listHeader}>많이 찾는 검색어</p>
        ) : undefined
      }
      className={className}
    />
  );
}
