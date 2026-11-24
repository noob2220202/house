'use client';
import { BannerTargeting } from '@house/shared';
import {
  Button,
  Checkbox,
  Chip,
  Icon,
  Input,
  Popover,
  SegmentedControl,
  Spinner,
  useDebouncedValue,
} from '@house/ui';
import { useId, useState } from 'react';
import { useComplexSearch, useRegions } from '../api/hooks';
import styles from './editor.module.css';
import { FormField } from './FormField';

export interface TargetRegion {
  code: string;
  name: string;
}
export interface TargetComplex {
  id: string;
  name: string;
}

export interface TargetingValue {
  targeting: BannerTargeting;
  regions: TargetRegion[];
  complexes: TargetComplex[];
}

export interface TargetingFieldProps {
  value: TargetingValue;
  onChange: (value: TargetingValue) => void;
  regionsError?: string;
  complexesError?: string;
}

const OPTIONS: readonly { value: BannerTargeting; label: string }[] = [
  { value: BannerTargeting.ALL, label: '전체' },
  { value: BannerTargeting.REGIONS, label: '특정 지역' },
  { value: BannerTargeting.COMPLEXES, label: '특정 단지' },
];

const HELP: Record<BannerTargeting, string> = {
  ALL: '모든 방문자에게 보여요',
  REGIONS: '관심 지역을 이곳으로 둔 회원과, 이 지역 지도를 본 방문자에게 보여요',
  COMPLEXES: '고른 단지의 상세 화면과 그 단지 매물을 보는 방문자에게 보여요',
};

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

function RegionPicker({
  selected,
  onChange,
  close,
}: {
  selected: TargetRegion[];
  onChange: (next: TargetRegion[]) => void;
  close: () => void;
}) {
  const [q, setQ] = useState('');
  const { data, isPending, isError, refetch } = useRegions();
  const term = squash(q);
  const items = (data?.items ?? []).filter(
    (r) => !term || squash(r.name).includes(term) || squash(r.parentName ?? '').includes(term),
  );
  const codes = new Set(selected.map((r) => r.code));
  return (
    <div className={styles.picker}>
      <Input
        aria-label="지역 검색"
        placeholder="동·지구 이름"
        className={styles.inMd}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-autofocus=""
      />
      {isPending ? (
        <p className={styles.pickEmpty} role="status">
          <Spinner size={18} label="지역 불러오는 중" />
        </p>
      ) : isError ? (
        <p className={styles.pickEmpty} role="alert">
          지역 목록을 불러오지 못했어요.{' '}
          <button type="button" className="link" onClick={() => void refetch()}>
            다시 시도
          </button>
        </p>
      ) : items.length === 0 ? (
        <p className={styles.pickEmpty}>일치하는 지역이 없어요</p>
      ) : (
        <ul className={styles.pickList}>
          {items.map((r) => (
            <li key={r.code}>
              <Checkbox
                checked={codes.has(r.code)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, { code: r.code, name: r.name }]
                      : selected.filter((s) => s.code !== r.code),
                  )
                }
              >
                {r.name}
                {r.parentName && <span className={styles.pickSub}>{r.parentName}</span>}
              </Checkbox>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.pickFt}>
        <span>{selected.length}곳 선택</span>
        <Button size="sm" onClick={close}>
          완료
        </Button>
      </div>
    </div>
  );
}

function ComplexPicker({
  selected,
  onChange,
  close,
}: {
  selected: TargetComplex[];
  onChange: (next: TargetComplex[]) => void;
  close: () => void;
}) {
  const [q, setQ] = useState('');
  const term = useDebouncedValue(q, 200);
  const { data, isPending, isError, refetch } = useComplexSearch(term);
  const items = data?.items ?? [];
  const ids = new Set(selected.map((c) => c.id));
  return (
    <div className={styles.picker}>
      <Input
        aria-label="단지 검색"
        placeholder="단지 이름 (예: 레이크파크)"
        className={styles.inMd}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-autofocus=""
      />
      {isPending ? (
        <p className={styles.pickEmpty} role="status">
          <Spinner size={18} label="단지 찾는 중" />
        </p>
      ) : isError ? (
        <p className={styles.pickEmpty} role="alert">
          단지를 불러오지 못했어요.{' '}
          <button type="button" className="link" onClick={() => void refetch()}>
            다시 시도
          </button>
        </p>
      ) : items.length === 0 ? (
        <p className={styles.pickEmpty}>일치하는 단지가 없어요</p>
      ) : (
        <ul className={styles.pickList}>
          {items.map((c) => (
            <li key={c.id}>
              <Checkbox
                checked={ids.has(c.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, { id: c.id, name: c.name }]
                      : selected.filter((s) => s.id !== c.id),
                  )
                }
              >
                {c.name}
                {c.emdName && <span className={styles.pickSub}>{c.emdName}</span>}
              </Checkbox>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.pickFt}>
        <span>{selected.length}곳 선택</span>
        <Button size="sm" onClick={close}>
          완료
        </Button>
      </div>
    </div>
  );
}

/** 노출 대상: 전체 / 특정 지역 / 특정 단지 with removable chips and a searchable picker popover. */
export function TargetingField({
  value,
  onChange,
  regionsError,
  complexesError,
}: TargetingFieldProps) {
  const id = useId();
  const { targeting, regions, complexes } = value;
  const error =
    targeting === BannerTargeting.REGIONS
      ? regionsError
      : targeting === BannerTargeting.COMPLEXES
        ? complexesError
        : undefined;
  return (
    <FormField label="노출 대상" labelId={`${id}-l`} error={error} help={HELP[targeting]}>
      <SegmentedControl
        label="노출 대상"
        className={styles.segFull}
        options={OPTIONS}
        value={targeting}
        onChange={(next) => onChange({ ...value, targeting: next })}
      />
      {targeting === BannerTargeting.REGIONS && (
        <div className={styles.tgChips}>
          {regions.map((r) => (
            <Chip
              key={r.code}
              selected
              removeLabel={`${r.name} 빼기`}
              onRemove={() =>
                onChange({ ...value, regions: regions.filter((x) => x.code !== r.code) })
              }
            >
              {r.name}
            </Chip>
          ))}
          <Popover
            label="노출 지역 선택"
            width={280}
            trigger={(p) => (
              <button type="button" className={styles.chipAdd} {...p}>
                <Icon name="plus" size={16} />
                지역 추가
              </button>
            )}
          >
            {(close) => (
              <RegionPicker
                selected={regions}
                onChange={(next) => onChange({ ...value, regions: next })}
                close={close}
              />
            )}
          </Popover>
        </div>
      )}
      {targeting === BannerTargeting.COMPLEXES && (
        <div className={styles.tgChips}>
          {complexes.map((c) => (
            <Chip
              key={c.id}
              selected
              removeLabel={`${c.name} 빼기`}
              onRemove={() =>
                onChange({ ...value, complexes: complexes.filter((x) => x.id !== c.id) })
              }
            >
              {c.name}
            </Chip>
          ))}
          <Popover
            label="노출 단지 선택"
            width={300}
            trigger={(p) => (
              <button type="button" className={styles.chipAdd} {...p}>
                <Icon name="plus" size={16} />
                단지 추가
              </button>
            )}
          >
            {(close) => (
              <ComplexPicker
                selected={complexes}
                onChange={(next) => onChange({ ...value, complexes: next })}
                close={close}
              />
            )}
          </Popover>
        </div>
      )}
    </FormField>
  );
}
