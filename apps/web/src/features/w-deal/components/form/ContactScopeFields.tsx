'use client';
import { DealRequestVisibility } from '@house/shared';
import {
  Avatar,
  Checkbox,
  Combobox,
  FieldError,
  FormRow,
  HelpLine,
  Icon,
  IconButton,
  Input,
  cx,
  type ComboboxOption,
  useDebouncedValue,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState, useSyncExternalStore } from 'react';
import { ROUTES } from '@/config/nav';
import { dealApi, dealKeys } from '../../api/client';
import type { ContactScopeValues, PickedAgency } from '../../lib/form-common';
import { MAX_TARGET_AGENCIES } from '../../lib/labels';
import styles from './form.module.css';

export type ContactScopeErrors = Partial<Record<keyof ContactScopeValues, string>>;
export type ContactScopeSetter = <K extends keyof ContactScopeValues>(
  key: K,
  value: ContactScopeValues[K],
) => void;

interface CommonProps {
  idPrefix: string;
  values: ContactScopeValues;
  errors: ContactScopeErrors;
  set: ContactScopeSetter;
  /** Validate a field when the user leaves it. */
  touch?: (key: keyof ContactScopeValues) => void;
}

/** 연락받을 이름 + 휴대폰 번호 (plain validated fields — the number is never verified, no SMS). */
export function ContactFields({ idPrefix, values, errors, set, touch }: CommonProps) {
  return (
    <>
      <FormRow label="이름" htmlFor={`${idPrefix}-name`} required>
        <div className={styles.pair}>
          <Input
            id={`${idPrefix}-name`}
            autoComplete="name"
            maxLength={30}
            placeholder="연락받을 분 이름"
            required
            value={values.contactName}
            error={errors.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            onBlur={() => touch?.('contactName')}
          />
        </div>
      </FormRow>
      <FormRow label="휴대폰 번호" htmlFor={`${idPrefix}-phone`} required>
        <div className={styles.inline}>
          <div className={styles.grow}>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              placeholder="010-1234-5678"
              prefix={<Icon name="phone" size={18} />}
              required
              value={values.contactPhone}
              error={errors.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              onBlur={() => touch?.('contactPhone')}
            />
          </div>
        </div>
        <HelpLine icon="lock">
          인증 절차 없이 입력한 번호로 연락드려요. 번호는{' '}
          <b>내가 연락처 공개에 동의한 중개사무소</b>
          에만 보여요.
        </HelpLine>
      </FormRow>
    </>
  );
}

export interface ScopeFieldsProps extends CommonProps {
  /** Number of agencies that receive an "all agencies" request (undefined while loading). */
  reachTotal?: number;
  /** "신대·선월" */
  areaLabel?: string | null;
  /** Region codes used to suggest nearby agencies in the picker. */
  regionCodes: readonly string[];
  /** 내놓기: "매물 근처", 구하기: "희망 지역". */
  nearLabel: string;
}

/** 공개 범위: 전체 중개사 (추천) / 선택한 중개사 + agency picker. */
export function ScopeFields({
  idPrefix,
  values,
  errors,
  set,
  reachTotal,
  areaLabel,
  regionCodes,
  nearLabel,
}: ScopeFieldsProps) {
  const labelId = `${idPrefix}-scope-label`;
  const selected = values.visibility === DealRequestVisibility.SELECTED_AGENCIES;
  return (
    <FormRow label="공개 범위" labelId={labelId} required>
      <div className={styles.scope} role="radiogroup" aria-labelledby={labelId}>
        <label className={cx(styles.opt, !selected && styles.sel)}>
          <input
            className="sr-only"
            type="radio"
            name={`${idPrefix}-scope`}
            checked={!selected}
            onChange={() => set('visibility', DealRequestVisibility.ALL_AGENCIES_IN_REGION)}
          />
          <span className={styles.radio} aria-hidden="true" />
          <span className={styles.optT}>
            <b>
              전체 중개사 <span className={styles.rec}>추천</span>
            </b>
            <span>
              {nearLabel} {areaLabel ? `${areaLabel} ` : ''}중개사무소
              {reachTotal !== undefined && (
                <>
                  {' '}
                  <b className="num">{reachTotal}곳</b>
                </>
              )}
              에 함께 전달돼요
            </span>
          </span>
        </label>
        <label className={cx(styles.opt, selected && styles.sel)}>
          <input
            className="sr-only"
            type="radio"
            name={`${idPrefix}-scope`}
            checked={selected}
            onChange={() => set('visibility', DealRequestVisibility.SELECTED_AGENCIES)}
          />
          <span className={styles.radio} aria-hidden="true" />
          <span className={styles.optT}>
            <b>선택한 중개사</b>
            <span>직접 고른 중개사무소에만 전달돼요 (최대 {MAX_TARGET_AGENCIES}곳)</span>
          </span>
        </label>
      </div>
      {selected && (
        <AgencyPicker
          id={`${idPrefix}-agency`}
          value={values.targetAgencies}
          onChange={(list) => set('targetAgencies', list)}
          regionCodes={regionCodes}
          error={errors.targetAgencies}
        />
      )}
    </FormRow>
  );
}

const NARROW = '(max-width: 720px)';
/** True on phone widths (false during SSR). */
function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(NARROW);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/** Search + pick up to MAX_TARGET_AGENCIES agencies (GET /deal-requests/target-agencies?q). */
export function AgencyPicker({
  id,
  value,
  onChange,
  regionCodes,
  error,
}: {
  id: string;
  value: PickedAgency[];
  onChange: (list: PickedAgency[]) => void;
  regionCodes: readonly string[];
  error?: string;
}) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 250);
  // Without a search word, suggest the agencies near the property / wanted regions.
  const query = q ? { q, pageSize: 8 } : { regionCodes: [...regionCodes], pageSize: 8 };
  const { data, isFetching, isError } = useQuery({
    queryKey: dealKeys.targets(query),
    queryFn: ({ signal }) => dealApi.targetAgencies(query, signal),
    placeholderData: (prev) => prev,
  });
  const full = value.length >= MAX_TARGET_AGENCIES;
  // The office name has priority: on phones the option shows the name only (the description
  // would squeeze it to a few characters), on wider screens the specialty next to it.
  const narrow = useNarrow();
  const options: ComboboxOption[] = (data?.items ?? [])
    .filter((a) => !value.some((v) => v.id === a.id))
    .map((a) => ({
      value: a.id,
      label: a.name,
      description: narrow ? undefined : (a.specialty ?? undefined),
    }));

  const add = (option: ComboboxOption) => {
    const agency = data?.items.find((a) => a.id === option.value);
    if (!agency || full) return;
    onChange([...value, { id: agency.id, name: agency.name, specialty: agency.specialty }]);
    setText('');
  };

  return (
    <div className={styles.picker}>
      <div className={styles.pickerHd}>
        <label htmlFor={id}>중개사무소 선택</label>
        <span>
          <b className="num">{value.length}</b> / {MAX_TARGET_AGENCIES}곳
        </span>
      </div>
      <Combobox
        id={id}
        options={full ? [] : options}
        inputValue={text}
        onInputChange={setText}
        onSelect={add}
        disabled={full}
        loading={isFetching}
        placeholder={full ? '최대 개수를 선택했어요' : '상호·대표·주소로 검색'}
        emptyText={isError ? '중개사무소를 불러오지 못했어요.' : '검색 결과가 없어요.'}
        error={error}
      />
      {value.length > 0 && (
        <ul className={styles.pickerList}>
          {value.map((a) => (
            <li key={a.id} className={styles.picked}>
              <Avatar name={a.name} size={36} square tone="soft" />
              <span className={styles.pickedT}>
                <b>{a.name}</b>
                {a.specialty && <span>{a.specialty}</span>}
              </span>
              <IconButton
                label={`${a.name} 선택 해제`}
                size={36}
                variant="plain"
                onClick={() => onChange(value.filter((v) => v.id !== a.id))}
              >
                <Icon name="close" size={18} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "제공받는 자" of the consent notice for the chosen 공개 범위. */
export function recipientsText(opts: {
  values: ContactScopeValues;
  nearLabel: string;
  areaLabel?: string | null;
  reachTotal?: number;
}): string {
  const { values, nearLabel, areaLabel, reachTotal } = opts;
  if (values.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
    const names = values.targetAgencies.map((a) => a.name).join(', ');
    return names
      ? `내가 선택한 중개사무소 ${values.targetAgencies.length}곳 (${names})`
      : '내가 선택한 중개사무소';
  }
  return `${nearLabel}${areaLabel ? ` ${areaLabel}` : ''} 중개사무소${
    reachTotal !== undefined ? ` ${reachTotal}곳` : ''
  } (이 서비스에 가입한 공인중개사사무소)`;
}

/** Statutory notice rows (개인정보 보호법 제15조·제17조): what, why, how long, refusal. */
type NoticeRows = readonly (readonly [string, string])[];

export interface ConsentFieldsProps extends CommonProps {
  kind: 'sell' | 'find';
  /** Who receives the request ("매물 근처 중개사무소 12곳", "선택한 중개사무소: A, B"). */
  recipients: string;
}

function privacyRows(kind: 'sell' | 'find'): NoticeRows {
  return [
    [
      '수집 항목',
      kind === 'sell'
        ? '이름, 휴대폰 번호, 매물 주소(동·호수 포함), 매물 정보와 사진'
        : '이름, 휴대폰 번호, 희망 지역·예산 등 찾는 조건',
    ],
    ['수집·이용 목적', '내놓기·구하기 요청 등록, 중개사무소 제안 전달, 요청 관리와 알림'],
    ['보유·이용 기간', '요청 종료 후 30일까지 (관계 법령에 보존 의무가 있으면 그 기간까지)'],
    ['거부 시 불이익', '동의하지 않을 수 있어요. 다만 동의하지 않으면 요청을 등록할 수 없어요.'],
  ];
}

function provideRows(kind: 'sell' | 'find', recipients: string): NoticeRows {
  return [
    ['제공받는 자', recipients],
    ['제공 목적', '중개 제안과 상담 연락'],
    [
      '제공 항목',
      kind === 'sell'
        ? '매물 유형·거래 조건·단지와 대략적인 위치. 이름·휴대폰 번호·동·호수는 내가 연락처 공개에 동의한 중개사무소에만 제공돼요.'
        : '찾는 조건. 이름·휴대폰 번호는 내가 연락처 공개에 동의한 중개사무소에만 제공돼요.',
    ],
    ['보유·이용 기간', '요청 종료 후 30일까지'],
    ['거부 시 불이익', '동의하지 않을 수 있어요. 다만 동의하지 않으면 요청을 등록할 수 없어요.'],
  ];
}

/** One required consent: checkbox + "보기" disclosure with the statutory notice inline. */
function ConsentItem({
  checked,
  invalid,
  onChange,
  label,
  title,
  rows,
}: {
  checked: boolean;
  invalid: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  title: string;
  rows: NoticeRows;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li>
      <Checkbox
        checked={checked}
        aria-invalid={invalid ? true : undefined}
        onChange={(e) => onChange(e.target.checked)}
      >
        {label}
      </Checkbox>
      <button
        type="button"
        className={cx('link', styles.agreeLink)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${title} 내용 ${open ? '접기' : '보기'}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '접기' : '보기'}
      </button>
      <div id={panelId} className={styles.agreeNotice} hidden={!open}>
        <dl>
          {rows.map(([dt, dd]) => (
            <div key={dt}>
              <dt>{dt}</dt>
              <dd>{dd}</dd>
            </div>
          ))}
        </dl>
        <Link className="link" href={ROUTES.terms('privacy')} target="_blank" rel="noopener">
          개인정보처리방침 전문 보기 (새 창)
        </Link>
      </div>
    </li>
  );
}

/**
 * 약관 동의: 전체 동의 + 개인정보 수집·이용 + 중개사무소(제3자) 제공 — both required, separate and
 * unchecked by default, each with its statutory notice (항목·목적·보유기간·거부 시 불이익) inline.
 */
export function ConsentFields({
  idPrefix,
  values,
  errors,
  set,
  kind,
  recipients,
}: ConsentFieldsProps) {
  const labelId = `${idPrefix}-agree-label`;
  const all = values.agreePrivacy && values.agreeProvide;
  const error = errors.agreePrivacy ?? errors.agreeProvide;
  return (
    <FormRow label="약관 동의" labelId={labelId} required>
      <div
        className={cx(styles.agree, !!error && styles.agreeErr)}
        role="group"
        aria-labelledby={labelId}
      >
        <div className={styles.agreeAll}>
          <Checkbox
            checked={all}
            onChange={(e) => {
              set('agreePrivacy', e.target.checked);
              set('agreeProvide', e.target.checked);
            }}
          >
            <b>필수 항목에 모두 동의합니다</b>
          </Checkbox>
        </div>
        <ul>
          <ConsentItem
            checked={values.agreePrivacy}
            invalid={!!errors.agreePrivacy}
            onChange={(on) => set('agreePrivacy', on)}
            label={
              kind === 'sell'
                ? '[필수] 개인정보 수집·이용 동의 (이름, 휴대폰 번호, 매물 주소)'
                : '[필수] 개인정보 수집·이용 동의 (이름, 휴대폰 번호, 찾는 조건)'
            }
            title="개인정보 수집·이용 동의"
            rows={privacyRows(kind)}
          />
          <ConsentItem
            checked={values.agreeProvide}
            invalid={!!errors.agreeProvide}
            onChange={(on) => set('agreeProvide', on)}
            label="[필수] 중개사무소 정보 제공 동의 (요청 종료 후 30일 보관)"
            title="중개사무소 정보 제공 동의"
            rows={provideRows(kind, recipients)}
          />
        </ul>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </FormRow>
  );
}
