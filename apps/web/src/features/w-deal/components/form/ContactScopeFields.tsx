'use client';
import { DealRequestVisibility } from '@house/shared';
import {
  Avatar,
  Checkbox,
  Combobox,
  ErrorState,
  FieldError,
  FormRow,
  HelpLine,
  Icon,
  IconButton,
  Input,
  SkeletonText,
  cx,
  type ComboboxOption,
  useDebouncedValue,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState, useSyncExternalStore } from 'react';
import { ROUTES } from '@/config/nav';
import { errorMessage, type ActionTermsDocument } from '@/lib/api';
import { formatDate } from '@/lib/format';
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

/** The consent documents of a deal request as `useActionTerms('DEAL_REQUEST')` loads them. */
export interface DealConsentTerms {
  data?: readonly ActionTermsDocument<'DEAL_REQUEST'>[];
  isError: boolean;
  error?: unknown;
  refetch: () => unknown;
}

export interface ConsentFieldsProps extends CommonProps {
  /** Who receives the request ("매물 근처 중개사무소 12곳", "선택한 중개사무소: A, B"). */
  recipients: string;
  /**
   * The published DEAL_REQUEST_PRIVACY / DEAL_REQUEST_PROVIDE documents (GET /terms/:type). Their
   * text is what the user reads here, and their versions are what the submission records.
   */
  terms: DealConsentTerms;
}

const CONSENT_LABEL: Record<ActionTermsDocument<'DEAL_REQUEST'>['type'], string> = {
  DEAL_REQUEST_PRIVACY: '개인정보 수집·이용 동의',
  DEAL_REQUEST_PROVIDE: '중개사무소 정보 제공 동의',
};

/** One required consent: checkbox + "보기" disclosure with the published document inline. */
function ConsentItem({
  checked,
  invalid,
  onChange,
  title,
  doc,
  extra,
}: {
  checked: boolean;
  invalid: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  doc: ActionTermsDocument<'DEAL_REQUEST'>;
  extra?: { label: string; value: string };
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
        [필수] {title}
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
        <p className={styles.agreeMeta}>
          <b>{doc.title || title}</b>
          <span className="num">
            버전 {doc.version}
            {doc.effectiveAt ? ` · 시행일 ${formatDate(doc.effectiveAt)}` : ''}
          </span>
        </p>
        {/* Plain text from the admin, line breaks preserved; rendered as text (never as HTML). */}
        <div className={styles.agreeText} tabIndex={0} role="document" aria-label={`${title} 전문`}>
          {doc.content}
        </div>
        {extra && (
          <dl>
            <div>
              <dt>{extra.label}</dt>
              <dd>{extra.value}</dd>
            </div>
          </dl>
        )}
        <Link className="link" href={ROUTES.terms('privacy')} target="_blank" rel="noopener">
          개인정보처리방침 전문 보기 (새 창)
        </Link>
      </div>
    </li>
  );
}

/**
 * 약관 동의: 전체 동의 + 개인정보 수집·이용 + 중개사무소(제3자) 제공 — both required, separate and
 * unchecked by default, each with its published document (항목·목적·보유기간·거부 시 불이익) inline.
 * The boxes stay disabled until the documents are loaded: nobody agrees to a text they could not
 * read.
 */
export function ConsentFields({ idPrefix, values, errors, set, recipients, terms }: ConsentFieldsProps) {
  const labelId = `${idPrefix}-agree-label`;
  const all = values.agreePrivacy && values.agreeProvide;
  const error = errors.agreePrivacy ?? errors.agreeProvide;
  const privacy = terms.data?.find((d) => d.type === 'DEAL_REQUEST_PRIVACY');
  const provide = terms.data?.find((d) => d.type === 'DEAL_REQUEST_PROVIDE');
  return (
    <FormRow label="약관 동의" labelId={labelId} required>
      {!privacy || !provide ? (
        terms.isError ? (
          <ErrorState
            compact
            title="동의 내용을 불러오지 못했어요"
            description={errorMessage(terms.error)}
            onRetry={() => void terms.refetch()}
          />
        ) : (
          <div className={styles.agree} aria-busy="true" aria-label="동의 내용을 불러오는 중">
            <div className={styles.agreeAll}>
              <SkeletonText lines={3} />
            </div>
          </div>
        )
      ) : (
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
              title={CONSENT_LABEL.DEAL_REQUEST_PRIVACY}
              doc={privacy}
            />
            <ConsentItem
              checked={values.agreeProvide}
              invalid={!!errors.agreeProvide}
              onChange={(on) => set('agreeProvide', on)}
              title={CONSENT_LABEL.DEAL_REQUEST_PROVIDE}
              doc={provide}
              extra={{ label: '이번 요청을 받는 곳', value: recipients }}
            />
          </ul>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
    </FormRow>
  );
}
