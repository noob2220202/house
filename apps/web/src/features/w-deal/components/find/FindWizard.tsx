'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ASSET_TYPE_LABEL,
  AssetType,
  DEAL_TYPE_LABEL,
  DealRequestVisibility,
  type DealType,
} from '@house/shared';
import {
  Badge,
  Checkbox,
  ChoiceChip,
  DealBadge,
  FieldError,
  FormRow,
  FormSection,
  Icon,
  Input,
  SegmentedControl,
  Textarea,
  cx,
  dealKindOf,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { ROUTES } from '@/config/nav';
import {
  ApiError,
  CONSENT_OUTDATED_MESSAGE,
  errorMessage,
  isConsentOutdatedError,
} from '@/lib/api';
import { useActionTerms } from '@/lib/api/useActionTerms';
import {
  formatDateKorean,
  formatPhone,
  formatPriceRange,
  pyeongToSqm,
  sqmToPyeong,
  toKstDateString,
  type AreaUnit,
} from '@/lib/format';
import { dealApi, dealKeys, type DealRequestCreatePayload } from '../../api/client';
import {
  AREA_BANDS,
  bandRangeText,
  bandsRange,
  budgetFieldsFor,
  budgetRangeText,
  findAreaMode,
  selectedBands,
  FIND_DEFAULTS,
  FIND_STEP_FIELDS,
  FIND_STEPS,
  findFormSchema,
  findProgress,
  MAX_FIND_REGIONS,
  toFindPayload,
  type FindFormValues,
} from '../../lib/find-form';
import { parseMoney } from '../../lib/form-common';
import { dealTypesFor, VISIBILITY_LABEL } from '../../lib/labels';
import { regionNamer, regionSummary, toRegionOptions, type RegionOption } from '../../lib/regions';
import {
  ConsentFields,
  ContactFields,
  recipientsText,
  ScopeFields,
  type ContactScopeSetter,
} from '../form/ContactScopeFields';
import { shownDealConsents } from '../form/consent-submit';
import styles from '../form/form.module.css';
import { MoneyInput } from '../form/MoneyInput';
import { AssetTypeTiles } from '../form/parts';
import { focusFirstError, setField, useWizard, type WizardUser } from '../form/useWizard';
import { WizardShell } from '../form/WizardShell';
import { ReachCard, useReach } from '../ReachCard';
import { PrivateTag, ReviewItem, ReviewSection } from '../sell/SellReview';

const ID = 'find';
/** Step with the 개인정보 consents (back to it when a consent document changed). */
const CONSENT_STEP = FIND_STEP_FIELDS.findIndex((f) => f.includes('agreePrivacy'));
const TITLES = [
  '어떤 집을 찾으세요?',
  '예산과 면적을 알려주세요',
  '연락처를 남겨주세요',
  '입력한 내용을 확인해 주세요',
];

interface StepProps {
  form: UseFormReturn<FindFormValues>;
  v: FindFormValues;
  err: (name: keyof FindFormValues) => string | undefined;
  set: <K extends keyof FindFormValues>(key: K, value: FindFormValues[K]) => void;
  touch: (key: keyof FindFormValues) => void;
}

const REGION_GROUPS: readonly { key: 'popular' | 'more'; title: string }[] = [
  { key: 'popular', title: '많이 찾는 지역' },
  { key: 'more', title: '그 밖의 지역' },
];

/**
 * Region picker options from `GET /regions` (the backend's codes), with the static presentation
 * list as fallback while loading / on error.
 */
function useRegionOptions(): { options: RegionOption[]; nameOf: (code: string) => string } {
  const { data } = useQuery({
    queryKey: dealKeys.regions(),
    queryFn: ({ signal }) => dealApi.regions(signal),
    staleTime: 60 * 60_000,
  });
  return useMemo(() => {
    const options = toRegionOptions(data);
    return { options, nameOf: regionNamer(options) };
  }, [data]);
}

/** Step 1 — A 찾는 조건: 매물 유형, 거래 유형 (multi), 희망 지역 (multi). */
function StepWanted({ form, v, err, set, regions }: StepProps & { regions: RegionOption[] }) {
  const toggleDeal = (deal: DealType, on: boolean) =>
    set('dealTypes', on ? [...v.dealTypes, deal] : v.dealTypes.filter((d) => d !== deal));
  const toggleRegion = (code: string, on: boolean) =>
    set('regionCodes', on ? [...v.regionCodes, code] : v.regionCodes.filter((c) => c !== code));
  return (
    <FormSection letter="A" title="찾는 조건">
      <FormRow label="매물 유형" labelId={`${ID}-type-label`} required error={err('assetType')}>
        <AssetTypeTiles
          name={`${ID}-type`}
          labelledBy={`${ID}-type-label`}
          value={v.assetType}
          invalid={!!err('assetType')}
          onChange={(value) => {
            set('assetType', value);
            const allowed = dealTypesFor(value);
            if (v.dealTypes.some((d) => !allowed.includes(d)))
              set(
                'dealTypes',
                v.dealTypes.filter((d) => allowed.includes(d)),
              );
            form.clearErrors('dealTypes');
          }}
        />
      </FormRow>
      <FormRow
        label="거래 유형"
        labelId={`${ID}-deal-label`}
        required
        help="여러 개 선택 가능"
        error={err('dealTypes')}
      >
        <div
          className={styles.chips}
          role="group"
          aria-labelledby={`${ID}-deal-label`}
          aria-invalid={err('dealTypes') ? true : undefined}
        >
          {dealTypesFor(v.assetType).map((deal) => (
            <ChoiceChip
              key={deal}
              type="checkbox"
              name={`${ID}-deal`}
              checked={v.dealTypes.includes(deal)}
              onChange={(on) => toggleDeal(deal, on)}
            >
              {DEAL_TYPE_LABEL[deal]}
            </ChoiceChip>
          ))}
        </div>
      </FormRow>
      <FormRow
        label="희망 지역"
        labelId={`${ID}-region-label`}
        required
        help={`${v.regionCodes.length}곳 선택 · 최대 ${MAX_FIND_REGIONS}곳`}
        error={err('regionCodes')}
      >
        {REGION_GROUPS.map((group) => (
          <div
            key={group.key}
            className={styles.rowC}
            role="group"
            aria-label={`희망 지역 — ${group.title}`}
            aria-invalid={err('regionCodes') && group.key === 'popular' ? true : undefined}
          >
            <p className={styles.chipGroupT}>{group.title}</p>
            <div className={styles.chips}>
              {regions
                .filter((r) => r.group === group.key)
                .map((r) => (
                  <ChoiceChip
                    key={r.code}
                    type="checkbox"
                    name={`${ID}-region`}
                    checked={v.regionCodes.includes(r.code)}
                    onChange={(on) => toggleRegion(r.code, on)}
                    hint={r.hint}
                  >
                    {r.name}
                  </ChoiceChip>
                ))}
            </div>
          </div>
        ))}
      </FormRow>
    </FormSection>
  );
}

function RangeRow({
  idBase,
  label,
  min,
  max,
  onMin,
  onMax,
  onBlur,
  errMin,
  errMax,
  minPlaceholder,
  maxPlaceholder,
}: {
  idBase: string;
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  onBlur: () => void;
  errMin?: string;
  errMax?: string;
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  const lo = parseMoney(min);
  const hi = parseMoney(max);
  // "2억 이하" / "1억 ~ 2억" (not "~ 2억 이하").
  const read =
    typeof hi === 'number' ? budgetRangeText(typeof lo === 'number' ? lo : undefined, hi) : '';
  return (
    <FormRow label={label} htmlFor={`${idBase}-max`} required help="최대 금액은 필수">
      <div className={styles.inline}>
        <MoneyInput
          id={`${idBase}-min`}
          aria-label={`${label} 최소`}
          value={min}
          placeholder={minPlaceholder}
          error={errMin}
          onChange={onMin}
          onBlur={onBlur}
        />
        <span className={styles.tilde} aria-hidden="true">
          ~
        </span>
        <MoneyInput
          id={`${idBase}-max`}
          aria-label={`${label} 최대`}
          value={max}
          placeholder={maxPlaceholder}
          required
          error={errMax}
          onChange={onMax}
          onBlur={onBlur}
        />
      </div>
      {read && (
        <p className={styles.priceRead} aria-live="polite">
          = <b className="num">{read}</b>
        </p>
      )}
    </FormRow>
  );
}

const ROOM_OPTIONS = [
  { value: '', label: '상관없음' },
  { value: '1', label: '1개+' },
  { value: '2', label: '2개+' },
  { value: '3', label: '3개+' },
  { value: '4', label: '4개+' },
] as const;

/** Step 2 — B 예산 · 면적: budget ranges per deal type, area range, rooms, move-in date, notes. */
function StepBudget({ form, v, err, set, touch }: StepProps) {
  const need = budgetFieldsFor(v.dealTypes);
  const areaMode = findAreaMode(v);
  const toggleBand = (key: string, on: boolean) =>
    set('areaBands', on ? [...v.areaBands, key] : v.areaBands.filter((k) => k !== key));
  const typeExclusive = () => {
    // Start the typed 전용 ㎡ range from the bands picked so far.
    const range = bandsRange(v.areaBands);
    set('areaMin', range?.min !== undefined ? String(range.min) : '');
    set('areaMax', range?.max !== undefined ? String(range.max) : '');
    set('areaUnit', 'sqm');
    set('areaCustom', true);
  };
  const convert = (text: string, unit: AreaUnit) => {
    const n = Number(text);
    if (!text.trim() || !Number.isFinite(n) || n <= 0) return text;
    return String(unit === 'sqm' ? pyeongToSqm(n) : sqmToPyeong(n, 1));
  };
  const changeUnit = (unit: AreaUnit) => {
    if (unit === v.areaUnit) return;
    set('areaMin', convert(v.areaMin, unit));
    set('areaMax', convert(v.areaMax, unit));
    set('areaUnit', unit);
  };
  const unitLabel = areaMode === 'custom' || v.areaUnit === 'sqm' ? '㎡' : '평';
  const showRooms = v.assetType !== AssetType.LAND && v.assetType !== AssetType.COMMERCIAL;
  return (
    <FormSection letter="B" title="예산 · 면적">
      {need.price && (
        <RangeRow
          idBase={`${ID}-price`}
          label="매매 예산"
          min={v.priceMin}
          max={v.priceMax}
          onMin={(value) => set('priceMin', value)}
          onMax={(value) => set('priceMax', value)}
          onBlur={() => touch('priceMax')}
          errMin={err('priceMin')}
          errMax={err('priceMax')}
          minPlaceholder="최소 (선택)"
          maxPlaceholder="예: 45,000"
        />
      )}
      {need.deposit && (
        <RangeRow
          idBase={`${ID}-deposit`}
          label={need.depositLabel}
          min={v.depositMin}
          max={v.depositMax}
          onMin={(value) => set('depositMin', value)}
          onMax={(value) => set('depositMax', value)}
          onBlur={() => touch('depositMax')}
          errMin={err('depositMin')}
          errMax={err('depositMax')}
          minPlaceholder="최소 (선택)"
          maxPlaceholder={need.depositLabel === '보증금' ? '예: 3,000' : '예: 20,000'}
        />
      )}
      {need.monthlyDeposit && (
        <RangeRow
          idBase={`${ID}-mdeposit`}
          label="월세 보증금"
          min={v.monthlyDepositMin}
          max={v.monthlyDepositMax}
          onMin={(value) => set('monthlyDepositMin', value)}
          onMax={(value) => set('monthlyDepositMax', value)}
          onBlur={() => touch('monthlyDepositMax')}
          errMin={err('monthlyDepositMin')}
          errMax={err('monthlyDepositMax')}
          minPlaceholder="최소 (선택)"
          maxPlaceholder="예: 3,000"
        />
      )}
      {need.rent && (
        <RangeRow
          idBase={`${ID}-rent`}
          label="월세"
          min={v.rentMin}
          max={v.rentMax}
          onMin={(value) => set('rentMin', value)}
          onMax={(value) => set('rentMax', value)}
          onBlur={() => touch('rentMax')}
          errMin={err('rentMin')}
          errMax={err('rentMax')}
          minPlaceholder="최소 (선택)"
          maxPlaceholder="예: 60"
        />
      )}
      {areaMode === 'bands' ? (
        <FormRow label="평형" labelId={`${ID}-band-label`} help="선택 · 여러 개 선택 가능">
          <div className={styles.chips} role="group" aria-labelledby={`${ID}-band-label`}>
            {AREA_BANDS.map((b) => (
              <ChoiceChip
                key={b.key}
                type="checkbox"
                name={`${ID}-band`}
                checked={v.areaBands.includes(b.key)}
                onChange={(on) => toggleBand(b.key, on)}
                hint={`전용 ${bandRangeText(b)}`}
              >
                {b.label}
              </ChoiceChip>
            ))}
          </div>
          <p className={styles.help}>
            공급 평형 기준이에요 · 전용 59㎡ ≈ 25평형, 전용 84㎡ ≈ 34평형
          </p>
          <button type="button" className={cx('link', styles.switchLink)} onClick={typeExclusive}>
            전용면적(㎡)으로 직접 입력
          </button>
        </FormRow>
      ) : (
        <FormRow
          label={areaMode === 'custom' ? '전용면적' : '면적'}
          htmlFor={`${ID}-area-min`}
          help={areaMode === 'custom' ? '선택 · ㎡ 단위' : '선택 · 전용(실)면적 기준'}
        >
          <div className={styles.inline}>
            <div className={styles.priceIn}>
              <Input
                id={`${ID}-area-min`}
                aria-label="최소 면적"
                inputMode="decimal"
                autoComplete="off"
                maxLength={8}
                suffix={unitLabel}
                placeholder="최소"
                error={err('areaMin')}
                {...form.register('areaMin')}
              />
            </div>
            <span className={styles.tilde} aria-hidden="true">
              ~
            </span>
            <div className={styles.priceIn}>
              <Input
                id={`${ID}-area-max`}
                aria-label="최대 면적"
                inputMode="decimal"
                autoComplete="off"
                maxLength={8}
                suffix={unitLabel}
                placeholder="최대"
                error={err('areaMax')}
                {...form.register('areaMax')}
              />
            </div>
            {areaMode === 'free' && (
              <SegmentedControl<AreaUnit>
                label="면적 단위"
                options={[
                  { value: 'pyeong', label: '평' },
                  { value: 'sqm', label: '㎡' },
                ]}
                value={v.areaUnit}
                onChange={changeUnit}
              />
            )}
          </div>
          {areaMode === 'custom' && (
            <button
              type="button"
              className={cx('link', styles.switchLink)}
              onClick={() => {
                set('areaCustom', false);
                form.clearErrors(['areaMin', 'areaMax']);
              }}
            >
              평형으로 고르기
            </button>
          )}
        </FormRow>
      )}
      {showRooms && (
        <FormRow label="방 수" labelId={`${ID}-rooms-label`} help="선택">
          <div className={styles.chips} role="radiogroup" aria-labelledby={`${ID}-rooms-label`}>
            {ROOM_OPTIONS.map((o) => (
              <ChoiceChip
                key={o.value || 'any'}
                type="radio"
                name={`${ID}-rooms`}
                checked={v.roomsMin === o.value}
                onChange={() => set('roomsMin', o.value)}
              >
                {o.label}
              </ChoiceChip>
            ))}
          </div>
        </FormRow>
      )}
      <FormRow label="입주 희망일" htmlFor={`${ID}-move`} help="선택">
        <div className={styles.inline}>
          <div className={styles.move}>
            <Input
              id={`${ID}-move`}
              type="date"
              min={toKstDateString()}
              error={err('moveInDate')}
              {...form.register('moveInDate')}
            />
          </div>
          <Checkbox {...form.register('moveInNegotiable')}>날짜 협의 가능</Checkbox>
        </div>
      </FormRow>
      <FormRow label="요청 사항" htmlFor={`${ID}-desc`} help="선택">
        <Textarea
          id={`${ID}-desc`}
          rows={4}
          maxLength={2800}
          placeholder="원하는 단지나 층, 학교·주차 같은 조건을 적어 주시면 더 잘 맞는 매물을 제안받을 수 있어요."
          error={err('description')}
          {...form.register('description')}
        />
        <span className={styles.counter} aria-hidden="true">
          {v.description.length.toLocaleString('ko-KR')} / 2,800
        </span>
      </FormRow>
    </FormSection>
  );
}

/** Budget lines for the summary / review: [["매매", "~ 4억 5,000"], …]. */
export function findBudgetLines(v: FindFormValues): [string, string][] {
  const need = budgetFieldsFor(v.dealTypes);
  const range = (min: string, max: string) => {
    const lo = parseMoney(min);
    const hi = parseMoney(max);
    return formatPriceRange(typeof lo === 'number' ? lo : null, typeof hi === 'number' ? hi : null);
  };
  const lines: [string, string][] = [];
  if (need.price) lines.push(['매매 예산', range(v.priceMin, v.priceMax)]);
  if (need.deposit) lines.push([need.depositLabel, range(v.depositMin, v.depositMax)]);
  if (need.monthlyDeposit)
    lines.push(['월세 보증금', range(v.monthlyDepositMin, v.monthlyDepositMax)]);
  if (need.rent) lines.push(['월세', range(v.rentMin, v.rentMax)]);
  return lines;
}

function findAreaText(v: FindFormValues): string {
  const mode = findAreaMode(v);
  if (mode === 'bands')
    return selectedBands(v.areaBands)
      .map((b) => b.label)
      .join(' · ');
  const unit = mode === 'custom' ? '㎡' : v.areaUnit === 'pyeong' ? '평' : '㎡';
  const pre = mode === 'custom' ? '전용 ' : '';
  if (v.areaMin.trim() && v.areaMax.trim()) return `${pre}${v.areaMin}~${v.areaMax}${unit}`;
  if (v.areaMin.trim()) return `${pre}${v.areaMin}${unit} 이상`;
  if (v.areaMax.trim()) return `${pre}${v.areaMax}${unit} 이하`;
  return '';
}

/** Aside card "구하기 요약". */
function FindSummary({
  v,
  step,
  nameOf,
}: {
  v: FindFormValues;
  step: number;
  nameOf: (code: string) => string;
}) {
  const { done, total } = findProgress(v);
  const budget = findBudgetLines(v);
  const head = budget.find(([, value]) => value);
  const rows: [string, string][] = [
    ...budget.filter(([label]) => label !== head?.[0]),
    ['면적', findAreaText(v) || '상관없음'],
    ['방 수', v.roomsMin ? `${v.roomsMin}개 이상` : '상관없음'],
    [
      '입주 희망일',
      v.moveInDate
        ? `${formatDateKorean(v.moveInDate)}${v.moveInNegotiable ? ' · 협의 가능' : ''}`
        : '상관없음',
    ],
    [
      '공개 범위',
      v.visibility === DealRequestVisibility.SELECTED_AGENCIES
        ? `${VISIBILITY_LABEL[v.visibility]} ${v.targetAgencies.length}곳`
        : VISIBILITY_LABEL[v.visibility],
    ],
  ];
  const regions = regionSummary(v.regionCodes, 2, nameOf);
  return (
    <section className={styles.sum} aria-labelledby="find-sum-t">
      <div className={styles.sumHd}>
        <h2 id="find-sum-t" className="t-title">
          구하기 요약
        </h2>
        <Badge>
          {step + 1} / {FIND_STEPS.length} 단계
        </Badge>
      </div>
      <div className={styles.sumText}>
        <span className={styles.sumTags}>
          {v.dealTypes.map((d) => (
            <DealBadge key={d} deal={dealKindOf(d)}>
              {DEAL_TYPE_LABEL[d]}
            </DealBadge>
          ))}
          {v.assetType && <span className="t-cap">{ASSET_TYPE_LABEL[v.assetType]}</span>}
        </span>
        <b className={`${styles.sumName} ${regions ? '' : styles.sumEmpty}`}>
          {regions || '희망 지역을 골라 주세요'}
        </b>
      </div>
      <div className={styles.sumPrice}>
        <span className="t-cap">{head?.[0] ?? '예산'}</span>
        {head ? (
          <p className={`price price-sm ${styles.sumPriceV}`}>{head[1]}</p>
        ) : (
          <p className={styles.sumPriceEmpty}>아직 입력 전이에요</p>
        )}
      </div>
      <dl className={styles.sumDl}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value ? undefined : styles.muted}>{value || '입력 전'}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.prog}>
        <div className={styles.progTop}>
          <span>필수 항목</span>
          <b className="num">
            {done} / {total}
          </b>
        </div>
        <div
          className={styles.progBar}
          role="progressbar"
          aria-label="필수 항목 입력"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className={styles.tip}>
          <Icon name="info" size={16} />
          <span>지역을 2~3곳 함께 고르고 요청 사항을 적어 두면 더 많은 제안을 받을 수 있어요.</span>
        </p>
      </div>
    </section>
  );
}

function FindReview({
  v,
  reachTotal,
  goTo,
  nameOf,
}: {
  v: FindFormValues;
  reachTotal?: number;
  goTo: (step: number) => void;
  nameOf: (code: string) => string;
}) {
  const selected = v.visibility === DealRequestVisibility.SELECTED_AGENCIES;
  return (
    <>
      <ReviewSection letter="A" title="찾는 조건" onEdit={() => goTo(0)}>
        <ReviewItem label="매물 유형">
          {v.assetType ? ASSET_TYPE_LABEL[v.assetType] : '-'}
        </ReviewItem>
        <ReviewItem label="거래 유형">
          {v.dealTypes.map((d) => DEAL_TYPE_LABEL[d]).join(' · ') || '-'}
        </ReviewItem>
        <ReviewItem label="희망 지역">
          {v.regionCodes.map((c) => nameOf(c)).join(', ') || '-'}
        </ReviewItem>
      </ReviewSection>
      <ReviewSection letter="B" title="예산 · 면적" onEdit={() => goTo(1)}>
        {findBudgetLines(v).map(([label, value]) => (
          <ReviewItem key={label} label={label}>
            <span className="num">{value || '-'}</span>
          </ReviewItem>
        ))}
        <ReviewItem label="면적">{findAreaText(v) || '상관없음'}</ReviewItem>
        <ReviewItem label="방 수">{v.roomsMin ? `${v.roomsMin}개 이상` : '상관없음'}</ReviewItem>
        <ReviewItem label="입주 희망일">
          {v.moveInDate
            ? `${formatDateKorean(v.moveInDate)}${v.moveInNegotiable ? ' · 협의 가능' : ''}`
            : '상관없음'}
        </ReviewItem>
        {v.description.trim() && <ReviewItem label="요청 사항">{v.description.trim()}</ReviewItem>}
      </ReviewSection>
      <ReviewSection letter="C" title="연락처 · 전달" onEdit={() => goTo(2)}>
        <ReviewItem label="연락처">
          {v.contactName} · <span className="num">{formatPhone(v.contactPhone)}</span>
          <PrivateTag />
        </ReviewItem>
        <ReviewItem label="공개 범위">
          {VISIBILITY_LABEL[v.visibility]}
          <small>
            {selected
              ? v.targetAgencies.map((a) => a.name).join(', ')
              : reachTotal !== undefined
                ? `희망 지역 중개사무소 ${reachTotal}곳에 함께 전달돼요`
                : '희망 지역 중개사무소에 함께 전달돼요'}
          </small>
        </ReviewItem>
        <ReviewItem label="약관 동의">개인정보 수집·이용, 중개사무소 정보 제공에 동의함</ReviewItem>
      </ReviewSection>
    </>
  );
}

/** 구하기 wizard: 찾는 조건 → 예산·면적 → 연락처·전달 → 확인·등록. */
export function FindWizard({ user }: { user: WizardUser }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FindFormValues>({
    defaultValues: FIND_DEFAULTS,
    resolver: zodResolver(findFormSchema),
    mode: 'onTouched',
  });
  const wizard = useWizard({
    kind: 'find',
    user,
    form,
    defaults: FIND_DEFAULTS,
    stepFields: FIND_STEP_FIELDS,
  });
  const v = form.watch();
  const { errors } = form.formState;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const err: StepProps['err'] = (name) =>
    (errors[name] as { message?: string } | undefined)?.message;
  // Choice controls validate at once; text fields only clear an existing error while typing.
  const set: StepProps['set'] = (key, value) =>
    setField(form, key, value, typeof value !== 'string' || !!errors[key]);
  const touch: StepProps['touch'] = (key) => void form.trigger(key);
  const setContact = set as unknown as ContactScopeSetter;
  const contactErrors = {
    contactName: err('contactName'),
    contactPhone: err('contactPhone'),
    targetAgencies: err('targetAgencies'),
    agreePrivacy: err('agreePrivacy'),
    agreeProvide: err('agreeProvide'),
  };

  const reach = useReach(v.regionCodes);
  const selected = v.visibility === DealRequestVisibility.SELECTED_AGENCIES;
  const regions = useRegionOptions();

  const terms = useActionTerms('DEAL_REQUEST');
  const create = useMutation({
    mutationFn: (payload: DealRequestCreatePayload) =>
      dealApi.create(payload, shownDealConsents(terms.data)),
    onSuccess: (created) => {
      wizard.finish();
      void queryClient.invalidateQueries({ queryKey: dealKeys.all });
      router.replace(`${ROUTES.dealFind}/complete?id=${encodeURIComponent(created.id)}`);
    },
    onError: (e) => {
      if (isConsentOutdatedError(e)) {
        // A consent document changed since the user read it: show the new text, ask again.
        setContact('agreePrivacy', false);
        setContact('agreeProvide', false);
        void terms.refetch();
        form.setError('agreePrivacy', { type: 'server', message: CONSENT_OUTDATED_MESSAGE });
        wizard.goTo(CONSENT_STEP);
        return;
      }
      if (e instanceof ApiError && e.isValidation) {
        const fields = e.fieldErrors();
        const known = (Object.keys(FIND_DEFAULTS) as (keyof FindFormValues)[]).filter(
          (name) => name in fields,
        );
        known.forEach((name) => form.setError(name, { type: 'server', message: fields[name] }));
        const first = known[0];
        if (first !== undefined) {
          const step = FIND_STEP_FIELDS.findIndex((f) => f.includes(first));
          if (step >= 0) wizard.goTo(step);
          return;
        }
      }
      setSubmitError(errorMessage(e));
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    if (wizard.step < wizard.lastStep) {
      await wizard.next();
      return;
    }
    if (create.isPending) return;
    const ok = await form.trigger();
    if (!ok) {
      const bad = FIND_STEP_FIELDS.findIndex((fields) =>
        fields.some((f) => form.getFieldState(f).invalid),
      );
      if (bad >= 0) wizard.goTo(bad);
      requestAnimationFrame(() => focusFirstError(wizard.formRef.current));
      return;
    }
    create.mutate(toFindPayload(form.getValues()));
  };

  const stepProps: StepProps = { form, v, err, set, touch };

  return (
    <WizardShell
      eyebrow="원하는 집 구하기"
      title={TITLES[wizard.step] ?? TITLES[0] ?? ''}
      crumb="구하기"
      steps={FIND_STEPS}
      stepperLabel="구하기 진행 단계"
      wizard={wizard}
      user={user}
      submitLabel="요청 등록하기"
      submitting={create.isPending || create.isSuccess}
      onSubmit={(e) => void onSubmit(e)}
      notice={
        <>
          요청을 등록하면 {selected ? '선택한' : '희망 지역'} 중개사무소에 바로 전달돼요. 30일 동안
          제안을 받을 수 있고, <b>내 요청 관리</b>에서 언제든 중단할 수 있어요.
        </>
      }
      error={submitError && <FieldError>{submitError}</FieldError>}
      aside={
        <>
          <FindSummary v={v} step={wizard.step} nameOf={regions.nameOf} />
          <ReachCard
            kind="find"
            regionCodes={v.regionCodes}
            selected={selected ? v.targetAgencies : null}
          />
        </>
      }
    >
      {wizard.step === 0 && <StepWanted {...stepProps} regions={regions.options} />}
      {wizard.step === 1 && <StepBudget {...stepProps} />}
      {wizard.step === 2 && (
        <>
          <FormSection letter="C" title="연락처">
            <ContactFields
              idPrefix={ID}
              values={v}
              errors={contactErrors}
              set={setContact}
              touch={touch}
            />
          </FormSection>
          <FormSection letter="D" title="전달 범위 · 동의">
            <ScopeFields
              idPrefix={ID}
              values={v}
              errors={contactErrors}
              set={setContact}
              reachTotal={reach.data?.total}
              areaLabel={reach.data?.areaLabel}
              regionCodes={v.regionCodes}
              nearLabel="희망 지역"
            />
            <ConsentFields
              idPrefix={ID}
              values={v}
              errors={contactErrors}
              set={setContact}
              terms={terms}
              recipients={recipientsText({
                values: v,
                nearLabel: '희망 지역',
                areaLabel: reach.data?.areaLabel,
                reachTotal: reach.data?.total,
              })}
            />
          </FormSection>
        </>
      )}
      {wizard.step === 3 && (
        <FindReview
          v={v}
          reachTotal={reach.data?.total}
          goTo={wizard.goTo}
          nameOf={regions.nameOf}
        />
      )}
    </WizardShell>
  );
}
