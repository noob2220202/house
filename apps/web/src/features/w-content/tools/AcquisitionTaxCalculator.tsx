'use client';
import { Checkbox, SegmentedControl, Select } from '@house/ui';
import { useMemo, useState } from 'react';
import {
  ACQUISITION_TAX_RULES,
  calculateAcquisitionTax,
  type AcquisitionPropertyKind,
  type HomeCount,
} from './lib/acquisition-tax';
import { formatRatePct, formatWon, formatWonKorean } from './lib/money';
import { CalcSection, Choice, Notes, ResultPanel, ResultRows } from './ui/CalcSection';
import { MoneyField } from './ui/MoneyField';

const PROPERTY_OPTIONS: { value: AcquisitionPropertyKind; label: string }[] = [
  { value: 'HOUSING', label: '주택' },
  { value: 'OTHER', label: '토지 · 상가 · 오피스텔' },
  { value: 'FARMLAND', label: '농지' },
];
const HOME_COUNT_OPTIONS = [
  { value: '1', label: '1주택 (이 집이 유일한 집)' },
  { value: '2', label: '2주택' },
  { value: '3', label: '3주택' },
  { value: '4', label: '4주택 이상 · 법인' },
];

/** 취득세 (기본) 계산기 — 유상취득, 비조정대상지역(순천시) 기준. */
export function AcquisitionTaxCalculator() {
  const [property, setProperty] = useState<AcquisitionPropertyKind>('HOUSING');
  const [price, setPrice] = useState<number | null>(44_500);
  const [homeCount, setHomeCount] = useState<HomeCount>(1);
  const [over85, setOver85] = useState(false);

  const result = useMemo(
    () => (price === null ? null : calculateAcquisitionTax({ property, price, homeCount, over85 })),
    [property, price, homeCount, over85],
  );

  return (
    <CalcSection
      id="acquisition-tax"
      icon="document"
      title="취득세"
      description="집이나 땅을 살 때 내는 취득세와 지방교육세, 농어촌특별세를 한 번에 계산해요."
      form={
        <>
          <Choice label="취득 물건">
            <SegmentedControl
              label="취득 물건"
              options={PROPERTY_OPTIONS}
              value={property}
              onChange={setProperty}
            />
          </Choice>
          <MoneyField label="취득가액 (매매가)" value={price} onChange={setPrice} />
          {property === 'HOUSING' && (
            <>
              <Select
                label="취득 후 주택 수"
                options={HOME_COUNT_OPTIONS}
                value={String(homeCount)}
                onChange={(e) => setHomeCount(Number(e.target.value) as HomeCount)}
                help="세대가 가진 주택 수에 이번에 사는 집을 더한 수예요."
              />
              <Checkbox checked={over85} onChange={(e) => setOver85(e.target.checked)}>
                전용면적이 85㎡를 넘어요 (농어촌특별세 대상)
              </Checkbox>
            </>
          )}
        </>
      }
      result={
        <ResultPanel
          label="내야 할 세금 합계"
          value={result ? formatWonKorean(result.totalWon) : null}
          sub={
            result
              ? `취득가액의 ${formatRatePct(result.totalRatePct)} · ${formatWon(result.totalWon)}`
              : undefined
          }
          placeholder="취득가액을 넣으면 바로 계산해 드려요."
        >
          {result && (
            <ResultRows
              rows={[
                {
                  label: '취득세',
                  value: formatWon(result.acquisitionTaxWon),
                  note: `${formatRatePct(result.acquisitionRatePct)}${result.surcharged ? ' · 다주택 중과' : ''}`,
                },
                {
                  label: '지방교육세',
                  value: formatWon(result.educationTaxWon),
                  note: formatRatePct(result.educationRatePct),
                },
                {
                  label: '농어촌특별세',
                  value: result.ruralRatePct === 0 ? '비과세' : formatWon(result.ruralTaxWon),
                  note:
                    result.ruralRatePct === 0
                      ? '전용 85㎡ 이하'
                      : formatRatePct(result.ruralRatePct),
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
          `${ACQUISITION_TAX_RULES.label}으로 계산해요. 순천시는 조정대상지역이 아니어서 2주택까지는 1 ~ 3% 기본세율이 적용돼요.`,
          '주택은 6억원 이하 1%, 6억원 초과 ~ 9억원 이하 (취득가액 × 2/3억 − 3)%, 9억원 초과 3%예요.',
          '생애최초 구입 감면, 일시적 2주택, 증여 · 상속 취득은 반영하지 않았어요. 정확한 세액은 위택스 또는 세무 전문가에게 확인해 주세요.',
        ]}
      />
    </CalcSection>
  );
}
