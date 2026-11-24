'use client';
import { Checkbox, SegmentedControl } from '@house/ui';
import { useMemo, useState } from 'react';
import { formatManwon } from '@/lib/format';
import { formatRatePct, formatWon, formatWonKorean, parseDecimalInput } from './lib/money';
import {
  TRANSFER_TAX_RULES,
  calculateTransferTax,
  type TransferPropertyKind,
  type TransferRateKind,
} from './lib/transfer-tax';
import { CalcSection, Choice, Notes, ResultPanel, ResultRows } from './ui/CalcSection';
import { MoneyField } from './ui/MoneyField';
import { NumberField } from './ui/NumberField';
import styles from './tools.module.css';

const PROPERTY_OPTIONS: { value: TransferPropertyKind; label: string }[] = [
  { value: 'HOUSING', label: '주택' },
  { value: 'PRESALE', label: '분양권' },
  { value: 'OTHER', label: '토지 · 상가' },
];

const RATE_KIND_NOTE: Record<TransferRateKind, string> = {
  progressive: ' 구간',
  'short-term': ' · 단기 양도',
  presale: ' · 분양권 단일세율',
};

const manwonText = (manwon: number): string => {
  const rounded = Math.round(manwon);
  return `${formatManwon(rounded)}${rounded % 10_000 === 0 && rounded !== 0 ? '원' : '만원'}`;
};

/** 양도소득세 간이 계산기 — 일반 누진세율 기준 참고용. */
export function TransferTaxCalculator() {
  const [property, setProperty] = useState<TransferPropertyKind>('HOUSING');
  const [salePrice, setSalePrice] = useState<number | null>(44_500);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(32_000);
  const [expenses, setExpenses] = useState<number | null>(800);
  const [years, setYears] = useState('5');
  const [oneHomeExempt, setOneHomeExempt] = useState(false);

  const holdingYears = parseDecimalInput(years);
  const result = useMemo(
    () =>
      salePrice === null || purchasePrice === null || holdingYears === null
        ? null
        : calculateTransferTax({
            property,
            salePrice,
            purchasePrice,
            expenses: expenses ?? 0,
            holdingYears,
            oneHomeExempt: property === 'HOUSING' && oneHomeExempt,
          }),
    [property, salePrice, purchasePrice, expenses, holdingYears, oneHomeExempt],
  );

  const presale = property === 'PRESALE';
  const exemptTooEarly =
    property === 'HOUSING' && oneHomeExempt && holdingYears !== null && holdingYears < 2;

  return (
    <CalcSection
      id="transfer-tax"
      icon="chart"
      title="양도소득세"
      description="집, 분양권, 땅을 팔 때 생긴 차익에 붙는 양도소득세를 간단히 계산해요."
      form={
        <>
          <Choice label="양도 물건">
            <SegmentedControl
              label="양도 물건"
              options={PROPERTY_OPTIONS}
              value={property}
              onChange={setProperty}
            />
          </Choice>
          <div className={styles.pair}>
            <MoneyField
              label="양도가액 (파는 가격)"
              value={salePrice}
              onChange={setSalePrice}
              help={presale ? '지금까지 낸 금액 + 받는 프리미엄' : undefined}
            />
            <MoneyField
              label="취득가액 (산 가격)"
              value={purchasePrice}
              onChange={setPurchasePrice}
              help={presale ? '지금까지 낸 계약금 · 중도금 (+ 산 프리미엄)' : undefined}
            />
          </div>
          <div className={styles.pair}>
            <MoneyField
              label="필요경비"
              value={expenses}
              onChange={setExpenses}
              steps={[1_000, 500, 100]}
              help="취득세, 중개보수, 법무비, 수리비 등"
            />
            <NumberField
              label="보유 기간"
              value={years}
              onChange={setYears}
              suffix="년"
              decimal
              maxLength={4}
              help="1년 6개월은 1.5로 입력해요"
            />
          </div>
          {property === 'HOUSING' && (
            <div>
              <Checkbox
                checked={oneHomeExempt}
                onChange={(e) => setOneHomeExempt(e.target.checked)}
              >
                1세대 1주택 비과세 요건을 갖췄어요 (2년 이상 보유)
              </Checkbox>
              {exemptTooEarly && (
                <p className={styles.hint} role="alert">
                  보유 기간이 2년이 안 되면 비과세가 적용되지 않아요.
                </p>
              )}
            </div>
          )}
        </>
      }
      result={
        <ResultPanel
          label="내야 할 세금 합계"
          value={result ? formatWonKorean(result.totalWon) : null}
          sub={
            result
              ? result.exempt
                ? `양도가액 ${TRANSFER_TAX_RULES.oneHomeExemptLimitManwon / 10_000}억원 이하 1세대 1주택 비과세`
                : result.gain === 0
                  ? '양도차익이 없어 세금이 없어요'
                  : `양도소득세 + 지방소득세 · ${formatWon(result.totalWon)}`
              : undefined
          }
          placeholder="양도가액, 취득가액, 보유 기간을 넣어 주세요."
        >
          {result && !result.exempt && result.gain > 0 && (
            <ResultRows
              rows={[
                {
                  label: '양도차익',
                  value: manwonText(result.taxableGain),
                  note: result.highValuePortion
                    ? '12억원 초과분만 과세'
                    : '양도가액 − 취득가액 − 필요경비',
                },
                {
                  label: '장기보유특별공제',
                  value:
                    result.longTermRatePct > 0
                      ? `− ${manwonText(result.longTermDeduction)}`
                      : '해당 없음',
                  note:
                    result.longTermRatePct > 0
                      ? formatRatePct(result.longTermRatePct)
                      : result.rateKind === 'presale'
                        ? '분양권은 공제 대상이 아니에요'
                        : '3년 이상 보유부터',
                },
                { label: '기본공제', value: `− ${manwonText(result.basicDeduction)}` },
                { label: '과세표준', value: manwonText(result.taxBase) },
                {
                  label: '양도소득세',
                  value: formatWon(result.incomeTaxWon),
                  note: `${formatRatePct(result.ratePct)}${RATE_KIND_NOTE[result.rateKind]}`,
                },
                {
                  label: '지방소득세',
                  value: formatWon(result.localTaxWon),
                  note: '양도소득세의 10%',
                },
                { label: '합계', value: formatWon(result.totalWon), strong: true },
              ]}
            />
          )}
        </ResultPanel>
      }
    >
      <Notes
        items={[
          `${TRANSFER_TAX_RULES.label} 기준의 간이 계산이에요.`,
          '분양권은 누진세율 대신 단일세율(보유 1년 미만 70%, 1년 이상 60%)이 적용되고, 장기보유특별공제와 1세대 1주택 비과세는 받을 수 없어요.',
          '다주택 중과, 비사업용 토지, 미등기 양도, 거주 기간에 따른 장기보유특별공제(최대 80%), 각종 감면은 반영하지 않았어요.',
          '실제 세액은 국세청 홈택스의 모의계산 또는 세무 전문가에게 꼭 확인해 주세요.',
        ]}
      />
    </CalcSection>
  );
}
