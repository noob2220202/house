'use client';
import { Checkbox, SegmentedControl } from '@house/ui';
import { useMemo, useState } from 'react';
import { formatManwon } from '@/lib/format';
import { FeeScheduleTable } from './FeeScheduleTable';
import {
  BROKERAGE_FEE_SCHEDULE,
  calculateBrokerageFee,
  type FeeDealKind,
  type FeePropertyKind,
} from './lib/brokerage-fee';
import { formatRatePct, formatWon, formatWonKorean, parseDecimalInput } from './lib/money';
import {
  CalcSection,
  Choice,
  Notes,
  ResultPanel,
  ResultRows,
  type ResultRow,
} from './ui/CalcSection';
import { MoneyField } from './ui/MoneyField';
import { NumberField } from './ui/NumberField';
import styles from './tools.module.css';

const PROPERTY_OPTIONS: { value: FeePropertyKind; label: string }[] = [
  { value: 'HOUSING', label: '주택' },
  { value: 'OFFICETEL', label: '오피스텔' },
  { value: 'OTHER', label: '토지 · 상가' },
];
const DEAL_OPTIONS: { value: FeeDealKind; label: string }[] = [
  { value: 'SALE', label: '매매' },
  { value: 'JEONSE', label: '전세' },
  { value: 'MONTHLY', label: '월세' },
  { value: 'PRESALE', label: '분양권' },
];

/** 중개보수 계산기 — 거래 유형별 상한요율표(BROKERAGE_FEE_SCHEDULE) 기준. */
export function FeeCalculator() {
  const [property, setProperty] = useState<FeePropertyKind>('HOUSING');
  const [deal, setDeal] = useState<FeeDealKind>('SALE');
  const [price, setPrice] = useState<number | null>(44_500);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [monthlyRent, setMonthlyRent] = useState<number | null>(null);
  const [premium, setPremium] = useState<number | null>(null);
  const [premiumMinus, setPremiumMinus] = useState(false);
  const [rate, setRate] = useState('');
  const [includeVat, setIncludeVat] = useState(false);

  // 분양권 is a housing-only deal type.
  const dealOptions = property === 'HOUSING' ? DEAL_OPTIONS : DEAL_OPTIONS.slice(0, 3);
  const activeDeal: FeeDealKind = property !== 'HOUSING' && deal === 'PRESALE' ? 'SALE' : deal;

  const negotiated = parseDecimalInput(rate);
  const result = useMemo(
    () =>
      calculateBrokerageFee({
        property,
        deal: activeDeal,
        price: price ?? undefined,
        deposit: deposit ?? undefined,
        monthlyRent: monthlyRent ?? undefined,
        premium: premium === null ? undefined : premiumMinus ? -premium : premium,
        negotiatedRatePct: negotiated ?? undefined,
        includeVat,
      }),
    [
      property,
      activeDeal,
      price,
      deposit,
      monthlyRent,
      premium,
      premiumMinus,
      negotiated,
      includeVat,
    ],
  );

  const rateError =
    result && negotiated !== null && negotiated > result.maxRatePct
      ? `상한요율 ${formatRatePct(result.maxRatePct)}까지만 적용돼요.`
      : undefined;

  const rows: ResultRow[] = result
    ? [
        {
          label: '거래금액',
          value: `${formatManwon(result.transactionAmount)}${result.transactionAmount % 10_000 === 0 ? '원' : '만원'}`,
          note:
            activeDeal === 'MONTHLY'
              ? `보증금 + 월세 × ${result.monthlyMultiplier}`
              : activeDeal === 'PRESALE'
                ? '납입금 + 프리미엄'
                : undefined,
        },
        {
          label: result.appliedRatePct < result.maxRatePct ? '협의 요율' : '상한요율',
          value: formatRatePct(result.appliedRatePct),
          note:
            result.appliedRatePct < result.maxRatePct
              ? `상한 ${formatRatePct(result.maxRatePct)}`
              : result.negotiable
                ? '이 안에서 협의'
                : undefined,
        },
        ...(result.capManwon !== undefined
          ? [
              {
                label: '한도액',
                value: `${result.capManwon}만원`,
                note: result.capped ? '한도액이 적용됐어요' : undefined,
              },
            ]
          : []),
        { label: '중개보수', value: formatWon(result.feeWon) },
        ...(includeVat ? [{ label: '부가가치세 (10%)', value: formatWon(result.vatWon) }] : []),
        {
          label: includeVat ? '합계 (부가세 포함)' : '합계',
          value: formatWon(result.totalWon),
          strong: true,
        },
      ]
    : [];

  const highlight =
    result && property === 'HOUSING' && result.bracketIndex !== undefined
      ? {
          table:
            activeDeal === 'SALE' || activeDeal === 'PRESALE'
              ? ('sale' as const)
              : ('lease' as const),
          index: result.bracketIndex,
        }
      : null;

  return (
    <CalcSection
      id="fee"
      icon="calc"
      title="중개보수"
      description="거래 유형과 금액을 넣으면 법정 상한요율로 중개보수를 계산해요."
      form={
        <>
          <Choice label="매물 종류">
            <SegmentedControl
              label="매물 종류"
              options={PROPERTY_OPTIONS}
              value={property}
              onChange={setProperty}
            />
          </Choice>
          <Choice label="거래 유형">
            <SegmentedControl
              label="거래 유형"
              options={dealOptions}
              value={activeDeal}
              onChange={setDeal}
            />
          </Choice>
          {activeDeal === 'MONTHLY' ? (
            <div className={styles.pair}>
              <MoneyField
                label="보증금"
                value={deposit}
                onChange={setDeposit}
                steps={[1_000, 500, 100]}
              />
              <MoneyField
                label="월세"
                value={monthlyRent}
                onChange={setMonthlyRent}
                steps={[10, 5, 1]}
                max={100_000}
              />
            </div>
          ) : activeDeal === 'PRESALE' ? (
            <>
              <MoneyField
                label="지금까지 낸 금액"
                value={price}
                onChange={setPrice}
                help="계약금 + 중도금 등 실제로 납입한 금액"
              />
              <div>
                <MoneyField
                  label="프리미엄"
                  value={premium}
                  onChange={setPremium}
                  steps={[1_000, 500, 100]}
                />
                <Checkbox
                  checked={premiumMinus}
                  onChange={(e) => setPremiumMinus(e.target.checked)}
                >
                  마이너스 프리미엄이에요
                </Checkbox>
              </div>
            </>
          ) : (
            <MoneyField
              label={activeDeal === 'JEONSE' ? '전세 보증금' : '매매가'}
              value={price}
              onChange={setPrice}
            />
          )}
          <div className={styles.pair}>
            <NumberField
              label="협의 요율 (선택)"
              value={rate}
              onChange={setRate}
              suffix="%"
              decimal
              maxLength={5}
              placeholder={result ? String(result.maxRatePct) : '0.4'}
              help="비워 두면 상한요율로 계산해요"
              error={rateError}
            />
            <div className={styles.inlineCheck}>
              <Checkbox checked={includeVat} onChange={(e) => setIncludeVat(e.target.checked)}>
                부가세 10% 포함
              </Checkbox>
            </div>
          </div>
        </>
      }
      result={
        <ResultPanel
          label={
            includeVat
              ? '중개보수 (부가세 포함)'
              : result?.negotiable
                ? '중개보수 (최대)'
                : '중개보수 (상한)'
          }
          value={result ? formatWonKorean(result.totalWon) : null}
          sub={result ? `거래 당사자 한쪽이 내는 금액 · ${formatWon(result.totalWon)}` : undefined}
          placeholder="거래 금액을 넣으면 바로 계산해 드려요."
        >
          <ResultRows rows={rows} />
        </ResultPanel>
      }
    >
      <details className={styles.details}>
        <summary>중개보수 요율표 보기</summary>
        <FeeScheduleTable schedule={BROKERAGE_FEE_SCHEDULE} highlight={highlight} />
      </details>
      <Notes
        items={[
          '표시된 금액은 법으로 정한 상한이에요. 실제 중개보수는 이 안에서 중개사무소와 협의해 정합니다.',
          '중개보수는 매도인(임대인)과 매수인(임차인)이 각각 냅니다.',
          '일반과세 사업자인 중개사무소는 부가가치세 10%가 따로 붙고, 간이과세 사업자는 다를 수 있어요.',
        ]}
      />
    </CalcSection>
  );
}
