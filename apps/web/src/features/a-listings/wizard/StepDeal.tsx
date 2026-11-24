'use client';
import {
  DEAL_TYPE_LABEL,
  DealType,
  MAINTENANCE_FEE_BILLING_TYPE_LABEL,
  MAINTENANCE_FEE_KIND_LABEL,
  MOVE_IN_TYPE_LABEL,
  MaintenanceFeeBillingType,
  MoveInType,
} from '@house/shared';
import {
  Checkbox,
  ChoiceChip,
  FieldError,
  FormSection,
  HelpLine,
  Input,
  MoneyInput as SharedMoneyInput,
  Select,
  cx,
  manwonHint,
} from '@house/ui';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { formatMaintenanceFee, formatPriceHint } from '@/lib/format';
import {
  dealTypesFor,
  formatDigits,
  isComplexAsset,
  isLand,
  parseMaintenanceFee,
  parseMoney,
  parsePremium,
  parseWon,
  type FeeItemValue,
  type ListingFormValues,
} from '../lib/form';
import { needsFeeAmounts } from '../lib/requirements';
import { FormRow, Readout } from './parts';
import styles from './wizard.module.css';

type MoneyField = 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice';

const DEAL_HINT: Record<DealType, string> = {
  SALE: '소유권 이전',
  JEONSE: '보증금만',
  MONTHLY: '보증금 + 월세',
  PRESALE: '분양가 + 프리미엄',
};

const BILLING_TYPES = [
  MaintenanceFeeBillingType.FIXED,
  MaintenanceFeeBillingType.ACTUAL,
  MaintenanceFeeBillingType.UNKNOWN,
] as const;

const BILLING_HINT: Record<MaintenanceFeeBillingType, string> = {
  FIXED: '매달 같은 금액',
  ACTUAL: '쓴 만큼 정산',
  UNKNOWN: '임대인 미고지 등',
};

/**
 * 관리비 세부내역 (「중개대상물의 표시·광고 명시사항 세부기준」): 부과방식, 포함 항목, and — for a
 * 정액관리비 of 10만원 or more — each item's monthly amount, which must add up to the 관리비.
 */
function MaintenanceFeeDetail({ feeWon }: { feeWon: number }) {
  const { register, setValue, clearErrors, formState } = useFormContext<ListingFormValues>();
  const { errors } = formState;
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const amounts = needsFeeAmounts(v.feeBillingType, feeWon);
  const unknown = v.feeBillingType === MaintenanceFeeBillingType.UNKNOWN;

  const setItems = (next: FeeItemValue[]) => {
    setValue('feeItems', next, { shouldDirty: true });
    clearErrors('feeItems');
  };
  const patchItem = (index: number, patch: Partial<FeeItemValue>) =>
    setItems(v.feeItems.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const included = v.feeItems.filter((row) => row.included);
  const sum = included.reduce((acc, row) => acc + (parseWon(row.amount) ?? 0), 0);
  const allPriced = included.length > 0 && included.every((row) => parseWon(row.amount) != null);

  return (
    <>
      <div className={styles.chipGroup}>
        <span className={styles.chipGroupT} id="l-feeBillingType">
          부과방식
          <span className={styles.req} aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </span>
        <div
          className={styles.chips}
          role="radiogroup"
          aria-labelledby="l-feeBillingType"
          aria-required
          aria-describedby={errors.feeBillingType ? 'e-feeBillingType' : undefined}
          id="f-feeBillingType"
        >
          {BILLING_TYPES.map((t) => (
            <ChoiceChip
              key={t}
              type="radio"
              name="feeBillingType"
              value={t}
              checked={v.feeBillingType === t}
              hint={BILLING_HINT[t]}
              onChange={() => {
                setValue('feeBillingType', t, { shouldDirty: true });
                clearErrors(['feeBillingType', 'feeItems', 'feeUnavailableReason']);
              }}
            >
              {MAINTENANCE_FEE_BILLING_TYPE_LABEL[t]}
            </ChoiceChip>
          ))}
        </div>
        {errors.feeBillingType?.message && (
          <FieldError id="e-feeBillingType">{errors.feeBillingType.message}</FieldError>
        )}
      </div>

      {unknown ? (
        <div className={styles.w480}>
          <Input
            id="f-feeUnavailableReason"
            label="확인할 수 없는 사유"
            required
            maxLength={200}
            placeholder="예: 임대인이 관리비 내역을 알려주지 않았어요"
            error={errors.feeUnavailableReason?.message ?? errors.feeBillingType?.message}
            {...register('feeUnavailableReason')}
          />
        </div>
      ) : (
        v.feeBillingType !== '' && (
          <div className={styles.chipGroup}>
            <span className={styles.chipGroupT} id="l-feeItems">
              {amounts ? '포함 항목과 금액' : '관리비에 포함된 항목'}
              <span className={styles.req} aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (필수)</span>
            </span>
            <div
              className={styles.chips}
              role="group"
              aria-labelledby="l-feeItems"
              aria-describedby={errors.feeItems ? 'e-feeItems' : undefined}
              id="f-feeItems"
            >
              {v.feeItems.map((row, i) => (
                <ChoiceChip
                  key={row.kind}
                  type="checkbox"
                  name="feeItems"
                  checked={row.included}
                  onChange={(on) => patchItem(i, { included: on, amount: on ? row.amount : '' })}
                >
                  {MAINTENANCE_FEE_KIND_LABEL[row.kind]}
                </ChoiceChip>
              ))}
            </div>
            {amounts && included.length > 0 && (
              <div className={styles.inline}>
                {v.feeItems.map((row, i) =>
                  row.included ? (
                    <div key={row.kind} className={cx(styles.w240, styles.num)}>
                      <Input
                        aria-label={`${MAINTENANCE_FEE_KIND_LABEL[row.kind]} 월 금액`}
                        prefix={MAINTENANCE_FEE_KIND_LABEL[row.kind]}
                        suffix="원"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        value={row.amount}
                        onChange={(e) => patchItem(i, { amount: formatDigits(e.target.value) })}
                      />
                    </div>
                  ) : null,
                )}
              </div>
            )}
            {amounts && included.length > 0 && (
              <Readout>
                항목 합계 <b>{sum.toLocaleString('ko-KR')}원</b>
                {allPriced && sum !== feeWon && (
                  <> · 관리비 {feeWon.toLocaleString('ko-KR')}원과 달라요</>
                )}
              </Readout>
            )}
            {errors.feeItems?.message && (
              <FieldError id="e-feeItems">{errors.feeItems.message}</FieldError>
            )}
          </div>
        )
      )}
    </>
  );
}

/** 만원 field = the shared @house/ui MoneyInput (with its "= 4억 4,500만원" reading). */
function MoneyInput({
  name,
  label,
  placeholder,
}: {
  name: MoneyField;
  label: string;
  placeholder?: string;
}) {
  const { control } = useFormContext<ListingFormValues>();
  return (
    <div className={cx(styles.w200, styles.num)}>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <SharedMoneyInput
            id={`f-${name}`}
            value={parseMoney(String(field.value ?? '')) ?? null}
            onValueChange={(n) => field.onChange(n === null ? '' : formatDigits(String(n)))}
            hint={manwonHint}
            placeholder={placeholder ?? '0'}
            error={fieldState.error?.message}
            required
            ref={field.ref}
            inputProps={{
              name: field.name,
              onBlur: field.onBlur,
              'aria-label': label,
              enterKeyHint: 'next',
            }}
          />
        )}
      />
    </div>
  );
}

/** Step 2 — 거래 형태 · 가격 · 관리비 · 입주가능일. */
export function StepDeal() {
  const { register, setValue, clearErrors, formState } = useFormContext<ListingFormValues>();
  const { errors } = formState;
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const land = isLand(v.assetType);
  const deals = dealTypesFor(v.assetType);
  const deal = deals.includes(v.dealType) ? v.dealType : DealType.SALE;

  const set = <K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) =>
    setValue(key, value as never, { shouldDirty: true });

  const premium = parsePremium(v.premium);
  const presale = parseMoney(v.presalePrice);
  const negative = v.premium.trim().startsWith('-');
  const presaleTotal =
    typeof presale === 'number' && typeof premium === 'number' ? presale + premium : null;
  const fee = parseMaintenanceFee(v.maintenanceFee);

  return (
    <>
      <FormSection letter="A" title="거래 형태">
        <FormRow label="거래 형태" labelId="l-dealType" required legal>
          <div
            className={styles.chips}
            role="radiogroup"
            aria-labelledby="l-dealType"
            aria-required
            id="f-dealType"
          >
            {deals.map((d) => (
              <ChoiceChip
                key={d}
                type="radio"
                name="dealType"
                value={d}
                checked={deal === d}
                onChange={() => {
                  set('dealType', d);
                  clearErrors(['salePrice', 'deposit', 'monthlyRent', 'presalePrice', 'premium']);
                }}
                hint={DEAL_HINT[d]}
              >
                {DEAL_TYPE_LABEL[d]}
              </ChoiceChip>
            ))}
          </div>
          {isComplexAsset(v.assetType) && (
            <HelpLine>
              분양권·입주권은 <b>분양권</b>으로 등록해요. 분양가와 프리미엄을 나눠 적으면 합계가
              자동으로 표시돼요.
            </HelpLine>
          )}
        </FormRow>
      </FormSection>

      <FormSection letter="B" title="가격" note="만원 단위">
        {deal === DealType.SALE && (
          <FormRow label="매매가" htmlFor="f-salePrice" required legal>
            <div className={cx(styles.inline)}>
              <MoneyInput name="salePrice" label="매매가" placeholder="예: 44,500" />
            </div>
          </FormRow>
        )}
        {deal === DealType.JEONSE && (
          <FormRow label="전세 보증금" htmlFor="f-deposit" required legal>
            <div className={styles.inline}>
              <MoneyInput name="deposit" label="전세 보증금" placeholder="예: 27,500" />
            </div>
          </FormRow>
        )}
        {deal === DealType.MONTHLY && (
          <FormRow label="보증금 / 월세" htmlFor="f-deposit" required legal>
            <div className={styles.inline}>
              <MoneyInput name="deposit" label="보증금" placeholder="보증금" />
              <span className={styles.sep} aria-hidden="true">
                /
              </span>
              <MoneyInput name="monthlyRent" label="월세" placeholder="월세" />
            </div>
            <HelpLine>보증금이 없으면 0을 입력해요. 월세는 관리비를 뺀 금액이에요.</HelpLine>
          </FormRow>
        )}
        {deal === DealType.PRESALE && (
          <>
            <FormRow
              label="분양가"
              htmlFor="f-presalePrice"
              required
              legal
              help="옵션·확장비 포함 여부를 설명에 적어 주세요."
            >
              <div className={styles.inline}>
                <MoneyInput name="presalePrice" label="분양가" placeholder="예: 39,200" />
              </div>
            </FormRow>
            <FormRow label="프리미엄" htmlFor="f-premium" required legal>
              <div className={styles.inline}>
                <div className={styles.w160}>
                  <Select
                    aria-label="프리미엄 부호"
                    value={negative ? '-' : '+'}
                    onChange={(e) => {
                      const body = v.premium.replace(/^\s*[-−–+]/, '');
                      set('premium', e.target.value === '-' ? `-${body}` : body);
                    }}
                    options={[
                      { value: '+', label: '플러스 (P +)' },
                      { value: '-', label: '마이너스 (P −)' },
                    ]}
                  />
                </div>
                <div className={cx(styles.w200, styles.num)}>
                  <Input
                    id="f-premium"
                    aria-label="프리미엄 금액"
                    aria-required
                    inputMode="numeric"
                    autoComplete="off"
                    suffix="만원"
                    placeholder="예: 2,700"
                    error={errors.premium?.message}
                    // Controlled on purpose (not registered): the sign lives in the form value, not
                    // in this input — a registered field would re-read the unsigned text on blur.
                    name="premium"
                    value={v.premium.replace(/^\s*[-−–+]/, '')}
                    onChange={(e) => {
                      const digits = formatDigits(e.target.value);
                      set('premium', negative ? `-${digits}` : digits);
                      clearErrors('premium');
                    }}
                  />
                </div>
              </div>
              <Readout>
                {presaleTotal !== null && presaleTotal > 0 && (
                  <>
                    분양권 매매가 = <b>{formatPriceHint(presaleTotal)}</b>
                  </>
                )}
              </Readout>
              <HelpLine>
                프리미엄이 없으면(무피) 0을 입력해요. 공개 화면에는 합계와 함께 ‘분양가 +
                프리미엄’이 나눠 표시돼요.
              </HelpLine>
            </FormRow>
          </>
        )}
        <HelpLine icon="shield">
          실제 거래할 수 있는 가격만 적어 주세요. 가격을 사실과 다르게 표시하면 부당한 표시·광고로
          과태료 대상이에요.
        </HelpLine>
      </FormSection>

      {!land && (
        <FormSection letter="C" title="관리비 · 입주">
          <FormRow label="관리비" htmlFor="f-maintenanceFee" required legal help="월 평균 금액">
            <div className={cx(styles.inline, styles.inlineCenter)}>
              <div className={cx(styles.w200, styles.num)}>
                <Input
                  id="f-maintenanceFee"
                  aria-label="월 관리비"
                  aria-required={!v.maintenanceNone}
                  inputMode="decimal"
                  autoComplete="off"
                  prefix="월"
                  suffix="만원"
                  placeholder="예: 15"
                  disabled={v.maintenanceNone}
                  error={errors.maintenanceFee?.message}
                  {...register('maintenanceFee')}
                />
              </div>
              <Checkbox
                checked={v.maintenanceNone}
                onChange={(e) => {
                  set('maintenanceNone', e.target.checked);
                  if (e.target.checked) {
                    clearErrors(['maintenanceFee', 'feeBillingType', 'feeItems']);
                  }
                }}
              >
                관리비 없음
              </Checkbox>
              {!v.maintenanceNone && typeof fee === 'number' && fee > 0 && (
                <Readout>
                  = 월 <b>{formatMaintenanceFee(fee)}</b>
                </Readout>
              )}
            </div>
            {!v.maintenanceNone && typeof fee === 'number' && fee > 0 && (
              <MaintenanceFeeDetail feeWon={fee} />
            )}
            <HelpLine>
              관리비는 월 평균 금액과 부과방식, 포함 항목을 함께 표시해요.{' '}
              <b>월 10만원 이상 정액관리비</b>는 항목별 금액까지 적어야 해요.
            </HelpLine>
          </FormRow>

          <FormRow
            label="입주가능일"
            labelId="l-moveInType"
            required
            legal
            error={errors.moveInType?.message}
          >
            <div
              className={styles.chips}
              role="radiogroup"
              aria-labelledby="l-moveInType"
              aria-required
              id="f-moveInType"
            >
              {Object.values(MoveInType).map((m) => (
                <ChoiceChip
                  key={m}
                  type="radio"
                  name="moveInType"
                  value={m}
                  checked={v.moveInType === m}
                  onChange={() => {
                    set('moveInType', m);
                    clearErrors(['moveInType', 'moveInDate']);
                  }}
                >
                  {MOVE_IN_TYPE_LABEL[m]}
                </ChoiceChip>
              ))}
            </div>
            {v.moveInType === MoveInType.DATE && (
              <div className={styles.w240}>
                <Input
                  id="f-moveInDate"
                  type="date"
                  aria-label="입주 가능 날짜"
                  aria-required
                  error={errors.moveInDate?.message}
                  {...register('moveInDate')}
                />
              </div>
            )}
            <HelpLine>
              바로 입주할 수 있으면 ‘즉시입주’, 날짜가 정해져 있으면 날짜를 적어요. 분양권은 입주
              예정일을 날짜로 적어 주세요.
            </HelpLine>
          </FormRow>
        </FormSection>
      )}
    </>
  );
}
