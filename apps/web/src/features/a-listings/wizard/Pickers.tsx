'use client';
import { Combobox, useDebouncedValue, type ComboboxOption } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { formatCount } from '@/lib/format';
import { geocode, listingKeys, searchComplexes } from '../api/queries';
import type { ComplexSearchItem, GeocodeItem } from '../api/schemas';

export interface ComplexSearchProps {
  onSelect: (item: ComplexSearchItem) => void;
  error?: string;
  id?: string;
  label?: string;
}

/** 단지 검색 (GET /complexes?q=): type a complex name or address, pick a result. */
export function ComplexSearch({ onSelect, error, id, label = '단지 검색' }: ComplexSearchProps) {
  const [text, setText] = useState('');
  const term = useDebouncedValue(text.trim(), 250);
  const searching = term.length >= 2;
  const { data, isFetching, isError } = useQuery({
    queryKey: listingKeys.complexSearch(term),
    queryFn: ({ signal }) => searchComplexes(term, signal),
    enabled: searching,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const items = useMemo(() => (searching ? (data?.items ?? []) : []), [searching, data]);
  const options: ComboboxOption[] = items.map((c) => ({
    value: c.id,
    label: c.name,
    description:
      [
        c.emdName,
        c.households ? `${formatCount(c.households)}세대` : null,
        c.builtYear ? `${c.builtYear}년` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
  }));

  return (
    <Combobox
      id={id}
      aria-label={label}
      placeholder="단지 이름 또는 도로명 주소로 검색"
      inputValue={text}
      onInputChange={setText}
      options={options}
      onSelect={(option) => {
        const item = items.find((c) => c.id === option.value);
        if (item) {
          setText('');
          onSelect(item);
        }
      }}
      loading={searching && isFetching}
      emptyText={
        isError
          ? '단지를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : '검색된 단지가 없어요. 이름을 다시 확인하거나 주소로 직접 입력해 주세요.'
      }
      error={error}
    />
  );
}

export interface AddressSearchProps {
  /** Currently selected road address ('' = none). */
  value: string;
  onSelect: (item: GeocodeItem) => void;
  /** The text no longer matches the selection. */
  onClear: () => void;
  error?: string;
  id?: string;
  placeholder?: string;
}

/** 주소 검색 (GET /geo/geocode): road name / 지번 / building → address + coordinates. */
export function AddressSearch({
  value,
  onSelect,
  onClear,
  error,
  id,
  placeholder,
}: AddressSearchProps) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  const term = useDebouncedValue(text.trim(), 250);
  const searching = term.length >= 2 && term !== value;
  const { data, isFetching, isError } = useQuery({
    queryKey: listingKeys.geocode(term),
    queryFn: ({ signal }) => geocode(term, signal),
    enabled: searching,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const items = useMemo(() => (searching ? (data?.items ?? []) : []), [searching, data]);
  const options: ComboboxOption[] = items.map((item, i) => ({
    value: String(i),
    label: item.roadAddress,
    description: [item.buildingName, item.jibunAddress].filter(Boolean).join(' · ') || undefined,
  }));

  return (
    <Combobox
      id={id}
      aria-label="주소 검색"
      placeholder={placeholder ?? '도로명, 지번, 건물명으로 검색 (예: 대학로 15)'}
      inputValue={text}
      onInputChange={(next) => {
        setText(next);
        if (value && next !== value) onClear();
      }}
      options={options}
      onSelect={(option) => {
        const item = items[Number(option.value)];
        if (item) onSelect(item);
      }}
      loading={searching && isFetching}
      emptyText={
        isError
          ? '주소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : '검색 결과가 없어요. 도로명과 건물번호를 확인해 주세요.'
      }
      error={error}
    />
  );
}
