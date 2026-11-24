'use client';
import {
  Icon,
  IconButton,
  SearchField,
  useDebouncedValue,
  type ComboboxOption,
  type IconName,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { SEARCH_MIN_LENGTH, SEARCH_SUGGEST_LIMIT, coreKeys, searchAdmin } from '../../api';
import {
  normalizeQuery,
  searchPageHref,
  searchSuggestions,
  type SuggestionKind,
} from '../../lib/search';
import styles from './GlobalSearch.module.css';

const KIND_ICON: Record<SuggestionKind, IconName> = {
  listing: 'building',
  agency: 'store',
  user: 'user',
  all: 'search',
};

const SUGGEST_DEBOUNCE_MS = 220;

/**
 * Topbar global search: live suggestions (매물번호 · 중개사 · 회원) from GET /admin/search while
 * typing, Enter opens the full results page. ⌘K / Ctrl+K focuses the field. On phones the pill is
 * replaced by an icon link to the search page (the topbar has no room for a field there).
 */
export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputId = useId();
  // On the results page the field mirrors the query being shown.
  const pageQuery = pathname === '/search' ? normalizeQuery(params.get('q')) : '';
  const [value, setValue] = useState(pageQuery);
  useEffect(() => setValue(pageQuery), [pageQuery, pathname]);

  const q = normalizeQuery(useDebouncedValue(value, SUGGEST_DEBOUNCE_MS));
  const typed = normalizeQuery(value);
  // Suggest only for what is in the field right now, and not for the query already on screen.
  const enabled = q.length >= SEARCH_MIN_LENGTH && q === typed && q !== pageQuery;
  const suggest = useQuery({
    queryKey: coreKeys.searchSuggest(q),
    queryFn: ({ signal }) => searchAdmin(q, signal, SEARCH_SUGGEST_LIMIT),
    enabled,
    staleTime: 30_000,
  });

  const suggestions = useMemo(
    () => (enabled && suggest.data ? searchSuggestions(suggest.data, q, ADMIN_ROUTES) : []),
    [enabled, suggest.data, q],
  );
  const options = useMemo<ComboboxOption[]>(
    () =>
      suggestions.map((s) => ({
        value: s.value,
        label: s.label,
        description: s.description,
        leading: (
          <span className={styles.lead} data-kind={s.kind}>
            <Icon name={KIND_ICON[s.kind]} size={16} />
          </span>
        ),
      })),
    [suggestions],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        const input = document.getElementById(inputId);
        if (input instanceof HTMLInputElement && input.offsetParent !== null) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputId]);

  const waiting =
    typed.length >= SEARCH_MIN_LENGTH && typed !== pageQuery && (q !== typed || suggest.isFetching);

  return (
    <>
      <SearchField
        id={inputId}
        className={styles.field}
        variant="pill"
        label="관리자 검색"
        placeholder="매물번호, 중개사, 회원 검색"
        value={value}
        onChange={setValue}
        options={options}
        loading={waiting && options.length === 0}
        emptyText={
          enabled && suggest.isSuccess && options.length === 0
            ? `‘${q}’ 검색 결과가 없어요`
            : enabled && suggest.isError
              ? '검색하지 못했어요. Enter로 다시 시도해 주세요.'
              : undefined
        }
        onSelect={(option) => {
          const hit = suggestions.find((s) => s.value === option.value);
          if (!hit) return;
          if (hit.kind !== 'all') setValue('');
          router.push(hit.href);
        }}
        onSubmit={(raw) => {
          const term = normalizeQuery(raw);
          if (term) router.push(searchPageHref(term));
        }}
      />
      <span className={styles.mobile}>
        <IconButton label="통합 검색" variant="plain" href="/search" linkAs={Link}>
          <Icon name="search" size={22} />
        </IconButton>
      </span>
    </>
  );
}
