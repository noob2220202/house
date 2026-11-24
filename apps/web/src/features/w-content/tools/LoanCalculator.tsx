'use client';
import { SegmentedControl, cx } from '@house/ui';
import { useMemo, useState } from 'react';
import {
  LOAN_LIMITS,
  REPAYMENT_METHOD_LABEL,
  calculateLoan,
  summarizeByYear,
  type RepaymentMethod,
} from './lib/loan';
import {
  formatWon,
  formatWonKorean,
  manwonToWon,
  parseDecimalInput,
  parseIntegerInput,
} from './lib/money';
import { CalcSection, Choice, Notes, ResultPanel, ResultRows } from './ui/CalcSection';
import { MoneyField } from './ui/MoneyField';
import { NumberField } from './ui/NumberField';
import styles from './tools.module.css';

const METHOD_OPTIONS = (Object.keys(REPAYMENT_METHOD_LABEL) as RepaymentMethod[]).map((value) => ({
  value,
  label: REPAYMENT_METHOD_LABEL[value],
}));
type PeriodUnit = 'year' | 'month';
type TableView = 'year' | 'month';

/** 대출 이자 계산기 — 원리금 균등 · 원금 균등 · 만기 일시, 거치 기간, 회차별 상환표. */
export function LoanCalculator() {
  const [principal, setPrincipal] = useState<number | null>(20_000);
  const [rate, setRate] = useState('4.2');
  const [period, setPeriod] = useState('30');
  const [unit, setUnit] = useState<PeriodUnit>('year');
  const [grace, setGrace] = useState('');
  const [method, setMethod] = useState<RepaymentMethod>('EQUAL_PAYMENT');
  const [view, setView] = useState<TableView>('year');

  const ratePct = parseDecimalInput(rate);
  const periodNumber = parseIntegerInput(period);
  const months = periodNumber === null ? null : unit === 'year' ? periodNumber * 12 : periodNumber;
  const graceMonths = (parseIntegerInput(grace) ?? 0) * (unit === 'year' ? 12 : 1);

  const rateError =
    ratePct !== null && ratePct > LOAN_LIMITS.maxRatePct
      ? `${LOAN_LIMITS.maxRatePct}% 이하로 입력해 주세요.`
      : undefined;
  const periodError =
    months !== null && months > LOAN_LIMITS.maxMonths
      ? `최대 ${LOAN_LIMITS.maxMonths / 12}년까지 계산할 수 있어요.`
      : months === 0
        ? '1 이상으로 입력해 주세요.'
        : undefined;
  const graceError =
    method !== 'BULLET' && months !== null && graceMonths >= months && graceMonths > 0
      ? '거치 기간은 대출 기간보다 짧아야 해요.'
      : undefined;

  const result = useMemo(
    () =>
      principal === null || ratePct === null || months === null || graceError
        ? null
        : calculateLoan({
            principal: manwonToWon(principal),
            annualRatePct: ratePct,
            months,
            method,
            graceMonths,
          }),
    [principal, ratePct, months, method, graceMonths, graceError],
  );

  const years = useMemo(() => (result ? summarizeByYear(result.schedule) : []), [result]);
  const uniform = result ? result.firstPayment === result.lastPayment : false;
  const hasGrace = method !== 'BULLET' && graceMonths > 0;

  return (
    <CalcSection
      id="loan"
      icon="calendar"
      title="대출 이자"
      description="대출 금액과 금리, 기간을 넣으면 상환 방식별 월 상환액과 총 이자를 계산해요."
      form={
        <>
          <MoneyField label="대출 금액" value={principal} onChange={setPrincipal} />
          <div className={styles.pair}>
            <NumberField
              label="연 이자율"
              value={rate}
              onChange={setRate}
              suffix="%"
              decimal
              maxLength={5}
              error={rateError}
            />
            <div className={styles.withUnit}>
              <NumberField
                label="대출 기간"
                value={period}
                onChange={setPeriod}
                suffix={unit === 'year' ? '년' : '개월'}
                maxLength={3}
                error={periodError}
              />
              <SegmentedControl
                label="기간 단위"
                size="sm"
                options={[
                  { value: 'year', label: '년' },
                  { value: 'month', label: '개월' },
                ]}
                value={unit}
                onChange={setUnit}
              />
            </div>
          </div>
          <Choice label="상환 방식">
            <SegmentedControl
              label="상환 방식"
              options={METHOD_OPTIONS}
              value={method}
              onChange={setMethod}
            />
          </Choice>
          {method !== 'BULLET' && (
            <NumberField
              label="거치 기간 (선택)"
              value={grace}
              onChange={setGrace}
              suffix={unit === 'year' ? '년' : '개월'}
              maxLength={3}
              placeholder="0"
              help="이자만 내는 기간이에요. 대출 기간에 포함돼요."
              error={graceError}
            />
          )}
        </>
      }
      result={
        <ResultPanel
          label={
            method === 'BULLET'
              ? '매달 내는 이자'
              : uniform || method === 'EQUAL_PAYMENT'
                ? '월 상환액'
                : '첫 달 상환액'
          }
          value={
            result
              ? formatWonKorean(
                  method === 'BULLET' ? result.schedule[0]!.payment : result.firstPayment,
                )
              : null
          }
          sub={
            result
              ? method === 'EQUAL_PRINCIPAL'
                ? `매달 줄어들어 마지막 달은 ${formatWon(result.lastPayment)}`
                : method === 'BULLET'
                  ? '만기에 원금을 한 번에 갚아요'
                  : hasGrace
                    ? `거치 기간에는 이자 ${formatWon(result.schedule[0]!.payment)}만 내요`
                    : '매달 같은 금액을 내요'
              : undefined
          }
          placeholder="대출 금액, 이자율, 기간을 넣어 주세요."
        >
          {result && (
            <ResultRows
              rows={[
                { label: '대출 원금', value: formatWon(manwonToWon(principal ?? 0)) },
                { label: '총 이자', value: formatWon(result.totalInterest) },
                { label: '월 평균 상환액', value: formatWon(result.averagePayment) },
                { label: '총 상환액', value: formatWon(result.totalPayment), strong: true },
              ]}
            />
          )}
        </ResultPanel>
      }
    >
      {result && (
        <details className={styles.details}>
          <summary>회차별 상환표 보기</summary>
          <div className={styles.tableTools}>
            <SegmentedControl
              label="상환표 단위"
              size="sm"
              options={[
                { value: 'year', label: '연 단위' },
                { value: 'month', label: '월 단위' },
              ]}
              value={view}
              onChange={setView}
            />
            <span className="t-cap">
              {view === 'year' ? `${years.length}년` : `${result.schedule.length}회차`}
            </span>
          </div>
          <div
            className={cx(styles.tableWrap, styles.scrollY)}
            tabIndex={0}
            role="region"
            aria-label="상환표"
          >
            <table className={cx(styles.table, styles.tableNum)}>
              <caption className="sr-only">
                {view === 'year' ? '연 단위 상환표' : '월 단위 상환표'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{view === 'year' ? '연차' : '회차'}</th>
                  <th scope="col" className={styles.right}>
                    상환액
                  </th>
                  <th scope="col" className={styles.right}>
                    원금
                  </th>
                  <th scope="col" className={styles.right}>
                    이자
                  </th>
                  <th scope="col" className={styles.right}>
                    잔액
                  </th>
                </tr>
              </thead>
              <tbody>
                {(view === 'year'
                  ? years.map((y) => ({ key: y.year, label: `${y.year}년차`, ...y }))
                  : result.schedule.map((r) => ({ key: r.month, label: `${r.month}회`, ...r }))
                ).map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td className={cx(styles.right, 'num')}>
                      {row.payment.toLocaleString('ko-KR')}
                    </td>
                    <td className={cx(styles.right, 'num')}>
                      {row.principal.toLocaleString('ko-KR')}
                    </td>
                    <td className={cx(styles.right, 'num')}>
                      {row.interest.toLocaleString('ko-KR')}
                    </td>
                    <td className={cx(styles.right, 'num')}>
                      {row.balance.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-cap" style={{ marginTop: 8 }}>
            단위: 원
          </p>
        </details>
      )}
      <Notes
        items={[
          '원리금 균등은 매달 같은 금액을, 원금 균등은 매달 같은 원금에 줄어드는 이자를 더해 내요. 총 이자는 원금 균등이 더 적어요.',
          '고정 금리로 계산한 참고 금액이에요. 실제 금리, 중도상환 수수료, 상환일은 금융기관에서 확인해 주세요.',
        ]}
      />
    </CalcSection>
  );
}
