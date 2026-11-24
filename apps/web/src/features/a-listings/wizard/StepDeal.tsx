'use client';
import { DEAL_TYPE_LABEL, DealType, MOVE_IN_TYPE_LABEL, MoveInType } from '@house/shared';
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
  type ListingFormValues,
} from '../lib/form';
import { needsFeeItems } from '../lib/requirements';
import { FormRow, Readout } from './parts';
import styles from './wizard.module.css';

type MoneyField = 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice';

const DEAL_HINT: Record<DealType, string> = {
  SALE: '소유권 이전',
  JEONSE: '보증금만',
  MONTHLY: '보증금 + 월세',
  PRESALE: '분양가 + 프리미엄',
};

/** 관리비에 포함되는 항목 (표시·광고 세부기준의 비목). */
export const FEE_ITEMS = [
  '일반관리비',
  '청소비',
  '승강기유지비',
  '수선유지비',
  '전기료',
  '수도료',
  '가스료',
  '난방비',
  '인터넷',
  'TV',
  '주차비',
] as const;

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
  const itemsRequired =
    !v.maintenanceNone && needsFeeItems(v.assetType || undefined, fee ?? undefined);

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
                  if (e.target.checked) clearErrors('maintenanceFee');
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
            {!v.maintenanceNone && (
              <div className={styles.chipGroup}>
                <span className={styles.chipGroupT} id="l-feeItems">
                  관리비에 포함된 항목
                  {itemsRequired && (
                    <>
                      <span className={styles.req} aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only"> (필수)</span>
                    </>
                  )}
                </span>
                <div
                  className={styles.chips}
                  role="group"
                  aria-labelledby="l-feeItems"
                  aria-describedby={errors.maintenanceFeeItems ? 'e-feeItems' : undefined}
                  id="f-maintenanceFeeItems"
                >
                  {FEE_ITEMS.map((item) => (
                    <ChoiceChip
                      key={item}
                      type="checkbox"
                      name="maintenanceFeeItems"
                      checked={v.maintenanceFeeItems.includes(item)}
                      onChange={(on) => {
                        set(
                          'maintenanceFeeItems',
                          on
                            ? [...v.maintenanceFeeItems, item]
                            : v.maintenanceFeeItems.filter((x) => x !== item),
                        );
                        clearErrors('maintenanceFeeItems');
                      }}
                    >
                      {item}
                    </ChoiceChip>
                  ))}
                </div>
                {errors.maintenanceFeeItems?.message && (
                  <FieldError id="e-feeItems">{errors.maintenanceFeeItems.message}</FieldError>
                )}
              </div>
            )}
            <HelpLine>
              관리비는 월 평균 금액으로 표시해요. 원룸·오피스텔·주택의{' '}
              <b>월 10만원 이상 정액 관리비</b>는 포함 항목(일반관리비·사용료 등)을 함께 표시해야
              해요.
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
