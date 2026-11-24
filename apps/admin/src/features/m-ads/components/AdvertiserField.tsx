'use client';
import { Combobox, Icon, cx, useDebouncedValue } from '@house/ui';
import { useId, useState } from 'react';
import { useAgencySearch } from '../api/hooks';
import styles from './editor.module.css';
import { FormField } from './FormField';

export interface AdvertiserValue {
  advertiserName: string;
  agency: { id: string; name: string } | null;
}

export interface AdvertiserFieldProps {
  value: AdvertiserValue;
  onChange: (value: AdvertiserValue) => void;
  error?: string;
}

/**
 * 광고주: free text for outside advertisers ("업체") or a 중개사무소 picked from the search
 * (`GET /agencies?q=`), which links the banner to that office (`agencyId`).
 */
export function AdvertiserField({ value, onChange, error }: AdvertiserFieldProps) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const text = value.agency ? value.agency.name : value.advertiserName;
  const term = useDebouncedValue(touched ? text : '', 200);
  const { data, isFetching } = useAgencySearch(term, touched);
  const options = (data?.items ?? []).map((a) => ({
    value: a.id,
    label: a.name,
    description: a.representativeName ? `대표 ${a.representativeName}` : undefined,
  }));
  const badge = value.agency ? '중개사무소' : text.trim() ? '업체' : null;
  return (
    <FormField label="광고주" htmlFor={id} error={error} errorId={`${id}-err`}>
      <div className={styles.adv}>
        <Icon name="search" size={18} />
        <Combobox
          id={id}
          className={cx(styles.advBox, !!badge && styles.advHasBadge)}
          aria-label="광고주"
          placeholder="중개사무소·업체 검색"
          inputValue={text}
          onInputChange={(next) => {
            setTouched(true);
            onChange({ advertiserName: next, agency: null });
          }}
          onSelect={(option) =>
            onChange({
              advertiserName: option.label,
              agency: { id: option.value, name: option.label },
            })
          }
          options={options}
          loading={isFetching && options.length === 0}
          emptyText="일치하는 중개사무소가 없어요. 입력한 이름 그대로 ‘업체’로 저장돼요."
        />
        {badge && (
          <span className={cx(styles.advBadge, !!value.agency && styles.advBadgeAgency)}>
            {badge}
          </span>
        )}
      </div>
    </FormField>
  );
}
