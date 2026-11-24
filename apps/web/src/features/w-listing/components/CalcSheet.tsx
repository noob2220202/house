'use client';
import { DEAL_TYPE_LABEL, DealType } from '@house/shared';
import {
  Button,
  Drawer,
  Icon,
  Input,
  MoneyInput as SharedMoneyInput,
  TabPanel,
  Tabs,
  manwonHint,
} from '@house/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { formatManwon, formatPriceHint, parsePriceInput } from '@/lib/format';
import type { ListingDetail } from '../api/schemas';
import {
  acquisitionTax,
  brokerageFee,
  defaultLoanPrincipal,
  formatManwonRound,
  loanPayment,
  monthlyTransactionAmount,
} from '../lib/calc';
import { useIsMobile } from '../lib/useIsMobile';
import {
  LOAN_DEFAULTS,
  calcPreviews,
  interestOnly,
  isHousing,
  isPurchase,
  type CalcTab,
} from '../lib/calcPreview';
import { headlineAmount } from '../lib/view';
import styles from './dialogs.module.css';

export type { CalcTab };

/** 만원 field = the shared @house/ui MoneyInput; the sheet keeps the typed text. */
function MoneyInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SharedMoneyInput
      id={id}
      label={label}
      value={parsePriceInput(value)}
      onValueChange={(n) => onChange(n === null ? '' : String(n))}
      hint={(n) => (n !== null && n > 0 ? manwonHint(n) : '예: 4억 4,500 또는 44500')}
      fullWidth
    />
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  suffix,
  step,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  step: number;
  max: number;
}) {
  return (
    <Input
      id={id}
      label={label}
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      suffix={suffix}
    />
  );
}

function Result({
  label,
  value,
  rows,
}: {
  label: string;
  value: string;
  rows: [string, string][];
}) {
  return (
    <div className={styles.calcResult} aria-live="polite">
      <span className={styles.calcResultK}>{label}</span>
      <b className={`${styles.calcResultV} num`}>{value}</b>
      <dl className={styles.calcRows}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="num">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LoanCalc({ listing }: { listing: ListingDetail }) {
  const purchase = isPurchase(listing);
  const d = purchase ? LOAN_DEFAULTS.purchase : LOAN_DEFAULTS.lease;
  const amount = headlineAmount(listing) ?? 0;
  const [principal, setPrincipal] = useState(() =>
    formatManwon(defaultLoanPrincipal(amount, d.ltvPct)),
  );
  const [rate, setRate] = useState(String(d.ratePct));
  const [years, setYears] = useState(String(d.years));
  const p = parsePriceInput(principal) ?? 0;
  const r = Number(rate);
  const y = Number(years);
  const pay = purchase ? loanPayment(p, r, y) : null;
  const interest = !purchase && p > 0 && r >= 0 ? interestOnly(p, r) : null;
  return (
    <div className={styles.calc}>
      <MoneyInput
        id="calc-loan-principal"
        label="대출 금액"
        value={principal}
        onChange={setPrincipal}
      />
      <div className={styles.calcPair}>
        <NumberInput
          id="calc-loan-rate"
          label="연 금리"
          value={rate}
          onChange={setRate}
          suffix="%"
          step={0.1}
          max={30}
        />
        <NumberInput
          id="calc-loan-years"
          label={purchase ? '상환 기간' : '대출 기간'}
          value={years}
          onChange={setYears}
          suffix="년"
          step={1}
          max={50}
        />
      </div>
      {pay ? (
        <Result
          label="매월 갚는 금액 (원리금균등)"
          value={`약 ${formatManwonRound(pay.monthly)}`}
          rows={[
            ['대출 원금', formatPriceHint(p)],
            ['총 이자', formatManwonRound(pay.totalInterest)],
            ['집값 대비', amount ? `${Math.round((p / amount) * 100)}%` : '-'],
          ]}
        />
      ) : interest !== null ? (
        <Result
          label="매월 내는 이자 (만기일시상환)"
          value={`약 ${formatManwonRound(interest)}`}
          rows={[
            ['대출 원금', formatPriceHint(p)],
            [`${y || 0}년 이자 합계`, formatManwonRound(interest * 12 * (y || 0))],
            ['보증금 대비', amount ? `${Math.round((p / amount) * 100)}%` : '-'],
          ]}
        />
      ) : (
        <p className={styles.calcEmpty}>대출 금액과 금리, 기간을 입력해 주세요.</p>
      )}
      <p className={styles.calcNote}>
        실제 금리와 한도는 소득, 신용, 대출 상품에 따라 달라요. 은행 상담 전 참고용으로만 봐 주세요.
      </p>
    </div>
  );
}

function FeeCalc({ listing }: { listing: ListingDetail }) {
  const monthly = listing.dealType === DealType.MONTHLY;
  const [price, setPrice] = useState(() =>
    formatManwon(monthly ? (listing.deposit ?? 0) : (headlineAmount(listing) ?? 0)),
  );
  const [rent, setRent] = useState(String(listing.monthlyRent ?? 0));
  const p = parsePriceInput(price) ?? 0;
  const fee = brokerageFee({
    assetType: listing.assetType,
    dealType: listing.dealType,
    price: monthly ? null : p,
    deposit: monthly ? p : null,
    monthlyRent: monthly ? Number(rent) || 0 : null,
  });
  return (
    <div className={styles.calc}>
      <MoneyInput
        id="calc-fee-price"
        label={monthly ? '보증금' : `${DEAL_TYPE_LABEL[listing.dealType]} 금액`}
        value={price}
        onChange={setPrice}
      />
      {monthly && (
        <NumberInput
          id="calc-fee-rent"
          label="월세"
          value={rent}
          onChange={setRent}
          suffix="만원"
          step={1}
          max={100000}
        />
      )}
      {fee ? (
        <Result
          label={fee.negotiable ? '중개보수 상한 (협의)' : '중개보수 상한'}
          value={`최대 ${formatManwonRound(fee.fee)}`}
          rows={[
            ...(monthly
              ? ([
                  [
                    '환산 거래금액',
                    `${formatManwon(monthlyTransactionAmount(p, Number(rent) || 0))}${''}`,
                  ],
                ] as [string, string][])
              : []),
            ['상한요율', `${fee.ratePct}%${fee.cap ? ` (한도 ${fee.cap}만원)` : ''}`],
            ['부가세 10% 포함', `최대 ${formatManwonRound(fee.fee * 1.1)}`],
          ]}
        />
      ) : (
        <p className={styles.calcEmpty}>거래 금액을 입력해 주세요.</p>
      )}
      <p className={styles.calcNote}>
        {fee?.negotiable
          ? '주택이 아닌 중개대상물은 거래금액의 0.9% 안에서 중개사무소와 협의해 정해요.'
          : '상한요율 안에서 중개사무소와 협의해 정해요. 공동중개여도 보수는 한 번만 냅니다.'}{' '}
        <Link className="link" href={ROUTES.terms('brokerage-fee')}>
          중개보수 안내
        </Link>
      </p>
    </div>
  );
}

function TaxCalc({ listing }: { listing: ListingDetail }) {
  const [price, setPrice] = useState(() => formatManwon(headlineAmount(listing) ?? 0));
  const p = parsePriceInput(price) ?? 0;
  const housing = isHousing(listing);
  const tax = acquisitionTax(p, { exclusiveAreaSqm: listing.property.exclusiveArea, housing });
  return (
    <div className={styles.calc}>
      <MoneyInput id="calc-tax-price" label="취득가액 (매매가)" value={price} onChange={setPrice} />
      {tax ? (
        <Result
          label={housing ? '취득세 합계 (1주택 기준)' : '취득세 합계'}
          value={`약 ${formatManwonRound(tax.total)}`}
          rows={[
            [`취득세 ${tax.ratePct}%`, formatManwonRound(tax.acquisition)],
            ['지방교육세', formatManwonRound(tax.localEducation)],
            ...(tax.ruralSpecial > 0
              ? ([['농어촌특별세', formatManwonRound(tax.ruralSpecial)]] as [string, string][])
              : []),
          ]}
        />
      ) : (
        <p className={styles.calcEmpty}>취득가액을 입력해 주세요.</p>
      )}
      <p className={styles.calcNote}>
        {housing
          ? '1세대 1주택 표준세율 기준이에요. 다주택, 생애 최초 감면, 조정대상지역 여부에 따라 달라질 수 있어요.'
          : '주택 외 부동산의 일반 세율(4.6%) 기준이에요. 농지 등은 세율이 다를 수 있어요.'}
      </p>
    </div>
  );
}

const TAB_LABEL: Record<CalcTab, string> = { loan: '대출 이자', fee: '중개보수', tax: '취득세' };

/** Inline calculators opened from the "이 가격으로 계산해 보기" card: side panel on desktop, bottom sheet on mobile. */
export function CalcSheet({
  listing,
  tab,
  onTabChange,
  onClose,
}: {
  listing: ListingDetail;
  tab: CalcTab;
  onTabChange: (tab: CalcTab) => void;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  const tabs = useMemo(() => calcPreviews(listing).map((p) => p.tab), [listing]);
  const available: CalcTab[] = tabs.length ? tabs : ['fee'];
  const current = available.includes(tab) ? tab : (available[0] ?? 'fee');
  return (
    <Drawer
      open
      onClose={onClose}
      side={mobile ? 'bottom' : 'right'}
      width={440}
      title="이 가격으로 계산해 보기"
      footer={
        <Button
          href={ROUTES.tools}
          linkAs={Link}
          variant="secondary"
          block
          iconRight={<Icon name="arrow-right" size={18} />}
        >
          부동산 계산기 전체 보기
        </Button>
      }
    >
      <Tabs
        label="계산기 종류"
        idBase="listing-calc"
        items={available.map((value) => ({ value, label: TAB_LABEL[value] }))}
        value={current}
        onChange={onTabChange}
      />
      <TabPanel idBase="listing-calc" value="loan" current={current}>
        <LoanCalc listing={listing} />
      </TabPanel>
      <TabPanel idBase="listing-calc" value="fee" current={current}>
        <FeeCalc listing={listing} />
      </TabPanel>
      <TabPanel idBase="listing-calc" value="tax" current={current}>
        <TaxCalc listing={listing} />
      </TabPanel>
    </Drawer>
  );
}
