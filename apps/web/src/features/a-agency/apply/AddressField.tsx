'use client';
import { Combobox, useDebouncedValue, type ComboboxOption } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type Ref } from 'react';
import { agencyKeys, geocode } from '../api/queries';
import type { GeocodeItem } from '../api/schemas';

export interface AddressFieldProps {
  /** Currently selected road address ('' = none). */
  value: string;
  /** A search result was chosen. */
  onSelect: (item: GeocodeItem) => void;
  /** The text no longer matches the selection → the form clears the address (and the pin). */
  onClear: () => void;
  error?: string;
  /** Ref of the search input (react-hook-form focuses it on a validation error). */
  inputRef?: Ref<HTMLInputElement>;
}

/** Address search (GET /geo/geocode): type a road name / 지번 / building, pick a result. */
export function AddressField({ value, onSelect, onClear, error, inputRef }: AddressFieldProps) {
  const [text, setText] = useState(value);
  // Mirror a new selection (or a form reset to an address) into the input. An emptied value is
  // NOT mirrored: it comes from the user editing the selected text, which must stay as typed so a
  // building number can be adjusted without retyping the whole query.
  useEffect(() => {
    if (value) setText(value);
  }, [value]);

  const term = useDebouncedValue(text.trim(), 250);
  const searching = term.length >= 2 && term !== value;
  const { data, isFetching, isError } = useQuery({
    queryKey: agencyKeys.geocode(term),
    queryFn: ({ signal }) => geocode(term, signal),
    enabled: searching,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const items = useMemo(() => (searching ? (data?.items ?? []) : []), [searching, data]);
  const options: ComboboxOption[] = items.map((item, i) => ({
    value: String(i),
    label: item.roadAddress,
    description: [item.buildingName, item.jibunAddress].filter(Boolean).join(' · ') || undefined,
  }));

  return (
    <Combobox
      ref={inputRef}
      label="사무소 주소"
      required
      placeholder="도로명, 지번, 건물명으로 검색 (예: 신대1로 18)"
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
      help="등록증에 적힌 사무소 소재지를 검색해서 선택해 주세요."
      error={error}
    />
  );
}
