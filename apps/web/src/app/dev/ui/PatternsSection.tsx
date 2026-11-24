'use client';
import {
  AgencyLogo,
  BackLink,
  Callout,
  Card,
  ChoiceChip,
  FormRow,
  FormSection,
  HelpLine,
  ListSearchField,
  MoneyInput,
  ProviderTile,
  Textarea,
  agencyLogoTone,
  manwonHint,
  type CalloutTone,
} from '@house/ui';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import s from './Gallery.module.css';

const TONES: readonly CalloutTone[] = ['info', 'brand', 'warn', 'danger', 'success', 'muted'];
const TONE_COPY: Record<CalloutTone, string> = {
  info: '연락처는 요청을 수락한 중개사에게만 공개돼요.',
  brand: '한 요청에는 사무소당 한 번만 제안할 수 있어요.',
  warn: '등기부등본의 소유자와 입력한 이름이 달라요. 서류를 다시 확인해 주세요.',
  danger: '사업자등록증 사진이 흐려서 반려됐어요. 다시 올려 주세요.',
  success: '중개사무소 등록 심사가 끝났어요.',
  muted: '열람 기록이 남는 화면이에요. 업무 목적 외 열람·복사는 금지돼요.',
};
const OFFICES = [
  { id: 'A01', name: '호수공원 공인중개사사무소' },
  { id: 'A02', name: '연향 부동산 중개법인' },
  { id: 'A03', name: '(주)신대부동산' },
  { id: 'A04', name: '왕지 중개사무소' },
  { id: 'A05', name: '조례 공인중개사' },
  { id: 'A06', name: '금당 부동산' },
];
const DEALS = [
  { v: 'SALE', label: '매매', hint: '소유권 이전' },
  { v: 'JEONSE', label: '전세', hint: '보증금만' },
  { v: 'MONTHLY', label: '월세', hint: '보증금 + 월세' },
] as const;
const OPTIONS = ['주차 가능', '반려동물', '엘리베이터', '즉시 입주'] as const;

function Box({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card padded>
      <div className={s.boxHd}>
        <h3 className={s.boxT}>{title}</h3>
        {note && <span className="t-cap">{note}</span>}
      </div>
      {children}
    </Card>
  );
}

const Label = ({ children }: { children: ReactNode }) => <p className={s.label}>{children}</p>;

/** Gallery entries for the cross-app patterns promoted into @house/ui (forms, notices, logos …). */
export function PatternsSection() {
  const [deal, setDeal] = useState<string>('MONTHLY');
  const [opts, setOpts] = useState<string[]>(['주차 가능']);
  const [price, setPrice] = useState<number | null>(44500);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [q2, setQ2] = useState('');
  const [log, setLog] = useState('');

  return (
    <section id="patterns" className={s.section} aria-labelledby="patterns-h">
      <header className={s.sectionHd}>
        <div>
          <p className={s.eyebrow}>11 · PATTERNS</p>
          <h2 id="patterns-h" className="t-h1">
            폼 · 안내 · 로고
          </h2>
        </div>
        <p className={s.lead}>
          여러 화면에 복사돼 있던 조각을 한 곳으로 모은 공용 컴포넌트입니다. 앱은 로컬 사본 대신
          이것을 씁니다.
        </p>
      </header>

      <div className={s.grid2}>
        <Box title="Callout" note="<Callout tone title live size />">
          <div className="stack" style={{ gap: 10 }}>
            {TONES.map((tone) => (
              <Callout key={tone} tone={tone} title={tone === 'danger' ? '반려 사유' : undefined}>
                {TONE_COPY[tone]}
              </Callout>
            ))}
            <Label>SIZE SM · ICON NULL</Label>
            <Callout size="sm" icon="shield">
              <strong>개인정보 보호.</strong> 상세 주소는 계약 단계에서만 공개돼요.
            </Callout>
            <Callout size="sm" tone="muted" icon={null}>
              아이콘 없이 쓰는 회색 안내문
            </Callout>
          </div>
        </Box>

        <Box title="ChoiceChip · MoneyInput" note="<ChoiceChip type /> · <MoneyInput hint steps />">
          <Label>RADIO</Label>
          <div className="row" role="radiogroup" aria-label="거래 형태" style={{ gap: 8 }}>
            {DEALS.map((d) => (
              <ChoiceChip
                key={d.v}
                type="radio"
                name="g-deal"
                value={d.v}
                checked={deal === d.v}
                onChange={() => setDeal(d.v)}
                hint={d.hint}
              >
                {d.label}
              </ChoiceChip>
            ))}
          </div>
          <Label>CHECKBOX · DISABLED</Label>
          <div className="row" role="group" aria-label="옵션" style={{ gap: 8 }}>
            {OPTIONS.map((o) => (
              <ChoiceChip
                key={o}
                type="checkbox"
                name="g-opt"
                value={o}
                checked={opts.includes(o)}
                disabled={o === '즉시 입주'}
                onChange={(on) => setOpts((p) => (on ? [...p, o] : p.filter((x) => x !== o)))}
              >
                {o}
              </ChoiceChip>
            ))}
          </div>
          <Label>MONEY · READOUT</Label>
          <MoneyInput
            id="g-price"
            label="매매가"
            required
            value={price}
            onValueChange={setPrice}
            hint={manwonHint}
          />
          <Label>QUICK STEPS · FULL WIDTH · "4억 4,500" 입력 가능</Label>
          <MoneyInput
            id="g-deposit"
            label="보증금"
            value={deposit}
            onValueChange={setDeposit}
            hint={(n) => (n ? manwonHint(n) : '예: 4억 4,500 또는 44500')}
            steps={[10000, 5000, 1000]}
            fullWidth
          />
        </Box>

        <Box title="ProviderTile · AgencyLogo" note="<ProviderTile size /> · <AgencyLogo seed />">
          <Label>SM 20 · MD 32 · LG 44</Label>
          <div className="row" style={{ gap: 16 }}>
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <span key={size} className="row" style={{ gap: 6 }}>
                <ProviderTile provider="kakao" size={size} label="카카오" />
                <ProviderTile provider="naver" size={size} label="네이버" />
                <ProviderTile provider="google" size={size} label="Google" />
              </span>
            ))}
          </div>
          <Label>AUTO (ID 로 고정) · 56PX</Label>
          <div className="row" style={{ gap: 10 }}>
            {OFFICES.map((o) => (
              <span key={o.id} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <AgencyLogo name={o.name} seed={o.id} />
                <small className="t-cap">{agencyLogoTone(o.id)}</small>
              </span>
            ))}
          </div>
          <Label>INITIALS 88 · ROUND 40 · ART 44</Label>
          <div className="row" style={{ gap: 12 }}>
            <AgencyLogo name={OFFICES[0]!.name} seed="A01" size={88} fallback="initials" />
            <AgencyLogo name={OFFICES[2]!.name} seed="A03" size={40} shape="round" />
            <AgencyLogo name={OFFICES[1]!.name} seed="A02" size={44} fallback="art" />
          </div>
        </Box>

        <Box
          title="ListSearchField · BackLink"
          note="<ListSearchField onSearch collapsible /> · <BackLink />"
        >
          <BackLink href="#patterns" linkAs={Link}>
            배너 목록
          </BackLink>
          <Label>FIELD</Label>
          <ListSearchField
            label="회원 검색"
            placeholder="이름, 이메일, 휴대폰 번호"
            value={q}
            onSearch={(term, mode) => {
              setQ(term);
              setLog(`${mode}: “${term}”`);
            }}
          />
          <Label>COLLAPSIBLE</Label>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>진행 중인 배너</b>
            <ListSearchField
              label="배너 검색"
              placeholder="배너 이름"
              value={q2}
              collapsible
              onSearch={(term, mode) => {
                setQ2(term);
                setLog(`${mode}: “${term}”`);
              }}
            />
          </div>
          <p className="t-cap" role="status" style={{ marginTop: 12 }}>
            {log || '입력을 멈추면 300ms 뒤, Enter·지우기는 바로 적용돼요.'}
          </p>
        </Box>
      </div>

      <Card style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <FormSection letter="A" title="매물 기본 정보" note="* 필수 항목">
          <FormRow
            label="거래 형태"
            labelId="g-l-deal"
            required
            labelAside={<span className="t-cap">명시사항</span>}
            help="표시·광고 기준에 따라 꼭 적어야 해요"
          >
            <div className="row" role="radiogroup" aria-labelledby="g-l-deal" style={{ gap: 8 }}>
              {DEALS.map((d) => (
                <ChoiceChip
                  key={d.v}
                  type="radio"
                  name="g-deal-2"
                  value={d.v}
                  checked={deal === d.v}
                  onChange={() => setDeal(d.v)}
                >
                  {d.label}
                </ChoiceChip>
              ))}
            </div>
            <HelpLine icon="lock">연락처는 요청을 수락한 중개사에게만 공개돼요.</HelpLine>
          </FormRow>
          <FormRow
            label="희망 가격"
            htmlFor="g-price-2"
            required
            error={price === null ? '희망 가격을 입력해 주세요.' : undefined}
          >
            <MoneyInput id="g-price-2" value={price} onValueChange={setPrice} hint={manwonHint} />
          </FormRow>
        </FormSection>
        <FormSection letter="B" title="추가 정보">
          <FormRow label="메모" htmlFor="g-memo" help="중개사에게 전할 말">
            <Textarea id="g-memo" rows={3} />
            <HelpLine icon="shield">
              <b>개인정보</b>는 적지 마세요.
            </HelpLine>
          </FormRow>
        </FormSection>
      </Card>
    </section>
  );
}
