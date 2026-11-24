'use client';
import {
  AdBadge,
  AdFrame,
  Avatar,
  AvatarStack,
  Badge,
  BarChart,
  Breadcrumb,
  BrokerCard,
  BrokersBadge,
  Button,
  Card,
  CategoryTile,
  Checkbox,
  Chip,
  Combobox,
  ComplexRow,
  ConfirmDialog,
  CtaBar,
  DealBadge,
  DealCount,
  Delta,
  Drawer,
  Dropzone,
  EmptyState,
  ErrorState,
  FilterDropdown,
  GoogleMark,
  ICON_NAMES,
  Icon,
  IconButton,
  Input,
  KakaoMark,
  LineChart,
  ListingCard,
  ListingCardSkeleton,
  Modal,
  NaverMark,
  PHOTO_KINDS,
  Pagination,
  Panel,
  PhotoPlaceholder,
  Popover,
  PremiumBadge,
  Radio,
  RadioGroup,
  RangeSlider,
  RankDelta,
  SearchField,
  SegmentedControl,
  Select,
  SheetSurface,
  Skeleton,
  SkeletonText,
  SocialButton,
  Sparkline,
  Spinner,
  StatTile,
  StatusPill,
  Stepper,
  Switch,
  Table,
  Tabs,
  Tag,
  Textarea,
  Tooltip,
  VerifiedBadge,
  useToast,
  type CategoryIconName,
  type DealKind,
  type TableSort,
} from '@house/ui';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import {
  MapBreadcrumb,
  MapSelectedCard,
  MapSummary,
  MapToolButton,
  MapView,
  MapZoomControl,
} from '@/components/map';
import { formatManwon, formatPriceFilter, formatPriceRange, formatPyeong } from '@/lib/format';
import type { MapMarker } from '@/lib/map';
import s from './Gallery.module.css';
import { PatternsSection } from './PatternsSection';

function Section({
  id,
  no,
  title,
  lead,
  children,
}: {
  id: string;
  no: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={s.section} aria-labelledby={`${id}-h`}>
      <header className={s.sectionHd}>
        <div>
          <p className={s.eyebrow}>{no}</p>
          <h2 id={`${id}-h`} className="t-h1">
            {title}
          </h2>
        </div>
        {lead && <p className={s.lead}>{lead}</p>}
      </header>
      {children}
    </section>
  );
}

function Box({
  title,
  note,
  children,
  wide,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Card padded className={wide ? s.wide : undefined}>
      <div className={s.boxHd}>
        <h3 className={s.boxT}>{title}</h3>
        {note && <span className="t-cap">{note}</span>}
      </div>
      {children}
    </Card>
  );
}

const Label = ({ children }: { children: ReactNode }) => <p className={s.label}>{children}</p>;

const COLORS: { name: string; token: string; note: string; dark?: boolean }[] = [
  { name: 'brand', token: '--brand', note: '주 행동, 링크, 선택', dark: true },
  { name: 'brand-hover', token: '--brand-hover', note: 'hover', dark: true },
  { name: 'brand-soft', token: '--brand-soft', note: '선택 배경' },
  { name: 'surface-ink', token: '--surface-ink', note: '프리미엄 다크 면', dark: true },
  { name: 'ground', token: '--ground', note: '페이지 바탕' },
  { name: 'surface-2', token: '--surface-2', note: '인셋, hover' },
  { name: 'accent', token: '--accent', note: '잉크 위 강조' },
  { name: 'success', token: '--success', note: '실매물 확인', dark: true },
  { name: 'warn', token: '--warn', note: '검수 대기', dark: true },
  { name: 'danger', token: '--danger', note: '오류, 신고', dark: true },
  { name: 'deal-presale', token: '--deal-presale', note: '분양·분양권', dark: true },
  { name: 'deal-sale', token: '--deal-sale', note: '매매', dark: true },
  { name: 'deal-jeonse', token: '--deal-jeonse', note: '전세', dark: true },
  { name: 'deal-monthly', token: '--deal-monthly', note: '월세', dark: true },
  { name: 'up', token: '--up', note: 'P+, 순위 상승', dark: true },
  { name: 'down', token: '--down', note: 'P−, 순위 하락', dark: true },
];

const CATEGORIES: { icon: CategoryIconName; label: string; caption: string; count: number }[] = [
  { icon: 'apt', label: '아파트·분양권', caption: '매매 · 전세 · 월세 · 분양권', count: 1284 },
  { icon: 'room', label: '원룸·투룸', caption: '대학가 · 역세권 · 오피스텔', count: 936 },
  { icon: 'house', label: '주택', caption: '단독 · 다가구 · 전원주택', count: 312 },
  { icon: 'biz', label: '상업·업무', caption: '상가 · 사무실 · 건물', count: 248 },
  { icon: 'land', label: '토지', caption: '대지 · 전 · 답 · 임야', count: 421 },
];

interface RankRow {
  id: string;
  rank: number;
  delta: number;
  name: string;
  dong: string;
  presale: number;
  sale: number;
  jeonse: number;
  monthly: number;
  recent: number;
  size: string;
}
const RANKING: RankRow[] = [
  {
    id: 'C01',
    rank: 1,
    delta: 0,
    name: '신대 레이크파크 1단지',
    dong: '해룡면 신대리',
    presale: 0,
    sale: 38,
    jeonse: 12,
    monthly: 6,
    recent: 43500,
    size: '34평',
  },
  {
    id: 'C02',
    rank: 2,
    delta: 2,
    name: '연향 센트럴',
    dong: '연향동',
    presale: 0,
    sale: 24,
    jeonse: 9,
    monthly: 5,
    recent: 36000,
    size: '32평',
  },
  {
    id: 'C03',
    rank: 3,
    delta: -1,
    name: '선월 하이츠 2차',
    dong: '해룡면 선월리',
    presale: 46,
    sale: 5,
    jeonse: 0,
    monthly: 2,
    recent: 41900,
    size: '33평 분양권',
  },
  {
    id: 'C04',
    rank: 4,
    delta: 1,
    name: '조례 호수마을',
    dong: '조례동',
    presale: 0,
    sale: 19,
    jeonse: 7,
    monthly: 4,
    recent: 29800,
    size: '32평',
  },
  {
    id: 'C05',
    rank: 5,
    delta: -2,
    name: '오천 그린빌',
    dong: '오천동',
    presale: 0,
    sale: 17,
    jeonse: 6,
    monthly: 8,
    recent: 25200,
    size: '24평',
  },
  {
    id: 'C06',
    rank: 6,
    delta: 0,
    name: '신대 레이크파크 3단지',
    dong: '해룡면 신대리',
    presale: 0,
    sale: 21,
    jeonse: 8,
    monthly: 2,
    recent: 41000,
    size: '33평',
  },
];

const MARKERS: MapMarker[] = [
  {
    kind: 'cluster',
    id: 'r-seokhyeon',
    position: { lat: 34.957, lng: 127.4765 },
    name: '석현동',
    count: 64,
  },
  {
    kind: 'cluster',
    id: 'r-seo',
    position: { lat: 34.925, lng: 127.468 },
    name: '서면',
    count: 84,
    outer: true,
    size: 'sm',
  },
  {
    kind: 'cluster',
    id: 'r-ocheon',
    position: { lat: 34.9165, lng: 127.5 },
    name: '오천지구',
    count: 201,
  },
  {
    kind: 'complex',
    id: 'C04',
    position: { lat: 34.964, lng: 127.53 },
    name: '조례 호수마을',
    count: 30,
    areaLabel: '32평',
    priceLabel: '2.9억',
  },
  {
    kind: 'complex',
    id: 'C08',
    position: { lat: 34.978, lng: 127.552 },
    name: '왕지 숲속마을',
    count: 12,
    areaLabel: '25평',
    priceLabel: '2.4억',
  },
  {
    kind: 'complex',
    id: 'C02',
    position: { lat: 34.949, lng: 127.534 },
    name: '연향 센트럴',
    count: 24,
    areaLabel: '32평',
    priceLabel: '3.6억',
  },
  {
    kind: 'complex',
    id: 'C07',
    position: { lat: 34.938, lng: 127.51 },
    name: '금당 리버뷰',
    count: 14,
    areaLabel: '31평',
    priceLabel: '2.7억',
  },
  {
    kind: 'complex',
    id: 'C03',
    position: { lat: 34.9295, lng: 127.533 },
    name: '선월 하이츠 2차',
    count: 46,
    areaLabel: '33평',
    dealNote: '분양권',
    priceLabel: '4.2억',
    presale: true,
  },
  {
    kind: 'complex',
    id: 'C01',
    position: { lat: 34.9215, lng: 127.58 },
    name: '레이크파크 1단지',
    count: 38,
    areaLabel: '34평',
    priceLabel: '4.4억',
  },
  {
    kind: 'price',
    id: 'R01',
    position: { lat: 34.969, lng: 127.488 },
    deal: 'monthly',
    priceLabel: '500/42',
  },
  {
    kind: 'price',
    id: 'R05',
    position: { lat: 34.946, lng: 127.49 },
    deal: 'jeonse',
    priceLabel: '9,000',
  },
  { kind: 'pin', id: 'P1', position: { lat: 34.975, lng: 127.515 }, count: 7 },
];

const VISITS = [3120, 3290, 3050, 3410, 3890, 3206, 3482];
const VISITS_PREV = [2980, 3180, 3010, 3240, 3620, 3150, 3206];
const DAYS = ['11.17 화', '11.18 수', '11.19 목', '11.20 금', '11.21 토', '11.22 일', '오늘'];

export function Gallery() {
  const { toast } = useToast();
  const [unit, setUnit] = useState('py');
  const [sort, setSort] = useState('verified');
  const [deal, setDeal] = useState('all');
  const [tab, setTab] = useState('freq');
  const [q, setQ] = useState('');
  const [combo, setCombo] = useState('');
  const [fav, setFav] = useState<Record<string, boolean>>({ L02: true });
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(5);
  const [tableSort, setTableSort] = useState<TableSort | null>({ key: 'rank', dir: 'asc' });
  const [picked, setPicked] = useState<string[]>(['C02']);
  const [price, setPrice] = useState<[number, number]>([30000, 50000]);
  const [draftPrice, setDraftPrice] = useState<[number, number]>(price);
  const [dealSet, setDealSet] = useState<string[]>(['SALE', 'JEONSE']);
  const [draftDeal, setDraftDeal] = useState<string[]>(dealSet);
  const [files, setFiles] = useState<string[]>([]);
  const [view, setView] = useState({ center: { lat: 34.948, lng: 127.53 }, zoom: 13 });
  const [selected, setSelected] = useState<string | null>('C01');
  const [bbox, setBbox] = useState('');

  const suggestions = useMemo(
    () =>
      q.trim()
        ? RANKING.filter((r) => r.name.includes(q.trim()) || r.dong.includes(q.trim())).map(
            (r) => ({ value: r.id, label: r.name, description: `${r.dong} · 단지` }),
          )
        : [],
    [q],
  );
  const sortedRanking = useMemo(() => {
    if (!tableSort) return RANKING;
    const key = tableSort.key as keyof RankRow;
    return [...RANKING].sort(
      (a, b) =>
        (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (tableSort.dir === 'asc' ? 1 : -1),
    );
  }, [tableSort]);
  const dealLabel = (v: string[]) =>
    v.length === 0
      ? '전체'
      : v
          .map((d) => ({ SALE: '매매', JEONSE: '전세', MONTHLY: '월세', PRESALE: '분양권' })[d])
          .join('·');

  return (
    <div className={s.page}>
      <header className={s.hero}>
        <div className="container">
          <Logo />
          <p className={s.eyebrow} style={{ marginTop: 28 }}>
            DESIGN SYSTEM · @house/ui
          </p>
          <h1 className="t-display" style={{ marginTop: 8 }}>
            컴포넌트 갤러리
          </h1>
          <p className="t-body" style={{ marginTop: 12, maxWidth: 640 }}>
            design/drafts/project/DesignSystem.dc.html 과 나란히 놓고 비교하는 개발 전용 화면입니다.
            운영 빌드에서는 404로 응답합니다.
          </p>
          <nav className={s.toc} aria-label="섹션">
            {[
              'tokens',
              'type',
              'icons',
              'controls',
              'badges',
              'cards',
              'map',
              'overlays',
              'feedback',
              'data',
              'patterns',
            ].map((id) => (
              <Chip key={id} href={`#${id}`}>
                {id}
              </Chip>
            ))}
            <Chip href="/" linkAs={Link} iconLeft={<Icon name="home" size={16} />}>
              shell
            </Chip>
          </nav>
        </div>
      </header>

      <div className="container">
        <Section
          id="tokens"
          no="01 · TOKENS"
          title="색 · 간격 · 모서리 · 그림자"
          lead="컴포넌트는 의미 토큰만 씁니다. 거래유형 색은 브랜드 색과 절대 겹치지 않습니다."
        >
          <div className={s.swatches}>
            {COLORS.map((c) => (
              <div key={c.name} className={s.swatch}>
                <span
                  style={{ background: `var(${c.token})`, color: c.dark ? '#fff' : 'var(--text)' }}
                >
                  Aa
                </span>
                <b>{c.name}</b>
                <small>{c.note}</small>
              </div>
            ))}
          </div>
          <div className={s.grid3} style={{ marginTop: 20 }}>
            <Box title="간격" note="--s-*">
              {[4, 8, 12, 16, 20, 24, 32, 40, 56, 80].map((n) => (
                <div key={n} className={s.spaceRow}>
                  <code>{n}px</code>
                  <i style={{ width: n * 2.4 }} />
                </div>
              ))}
            </Box>
            <Box title="모서리" note="--r-*">
              <div className={s.radii}>
                {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'pill'] as const).map((r) => (
                  <span key={r}>
                    <i style={{ borderRadius: `var(--r-${r})` }} />
                    r-{r}
                  </span>
                ))}
              </div>
            </Box>
            <Box title="그림자" note="--sh-*">
              <div className={s.shadows}>
                {(['1', '2', '3', 'brand'] as const).map((n) => (
                  <span key={n} style={{ boxShadow: `var(--sh-${n})` }}>
                    sh-{n}
                  </span>
                ))}
              </div>
            </Box>
          </div>
        </Section>

        <Section
          id="type"
          no="02 · TYPOGRAPHY"
          title="타이포그래피"
          lead="Inter(라틴·숫자, tnum) + Noto Sans KR(한글). 가격은 숫자가 단위보다 먼저 보이게 합니다. 12px 미만 글자는 쓰지 않습니다."
        >
          <div className={s.grid2}>
            <Box title="글자 크기 단계" note="Inter + Noto Sans KR · 400–800">
              <div className={s.typeRows}>
                <p className="t-display">순천의 집</p>
                <p className="t-h1">방금 확인된 실매물</p>
                <p className="t-h2">사람들이 자주 찾는 단지</p>
                <p className="t-h3">신대 레이크파크 1단지</p>
                <p className="t-title">중개업소 3곳이 함께 가진 매물이에요</p>
                <p className="t-body">
                  같은 집을 여러 중개사무소가 가지고 있어도 한 번만 보여드려요. 실매물 확인 날짜와
                  보유 중개사까지 한눈에 확인하세요.
                </p>
                <p className="t-sm">해룡면 신대리 · 1,412세대 · 2019년 준공</p>
                <p className="t-cap">실매물 확인 26.11.22 · 중개사 3곳</p>
              </div>
            </Box>
            <Box title="가격 표기" note=".price · Inter 800 · −0.04em">
              <div className={s.typeRows}>
                <p className="price price-xl">{formatManwon(44500)}</p>
                <p className="row">
                  <span className="price">{formatManwon(41900)}</span>
                  <PremiumBadge amount={2700} />
                </p>
                <p className="price price-sm">월세 500/42 · 전세 {formatManwon(24000)}</p>
                <p className="price">
                  1,180<span className="unit">만/평</span>
                </p>
                <p className="t-sm">
                  억/만 4억 4,500 · 월세 보증금/월세 500/42 · 층 고/25층 · 면적{' '}
                  {formatPyeong(112.4)} ↔ 112㎡ · 날짜 26.11.22
                </p>
              </div>
            </Box>
          </div>
        </Section>

        <Section
          id="icons"
          no="03 · ICONS"
          title="아이콘"
          lead="24px 격자, 선 굵기 1.75, currentColor. 카테고리 아이콘은 같은 선 아이콘에 코발트 디테일 하나만 남겼습니다."
        >
          <Box title="시스템 아이콘" note={`${ICON_NAMES.length}개 · <Icon name="…" />`}>
            <div className={s.icons}>
              {ICON_NAMES.map((n) => (
                <span key={n}>
                  <Icon name={n} />
                  <small>{n}</small>
                </span>
              ))}
            </div>
          </Box>
          <div className={s.grid2} style={{ marginTop: 20 }}>
            <Box title="간편 로그인" note="카카오 · 네이버 · Google 만 지원">
              <div className="row" style={{ marginBottom: 16 }}>
                <span className={s.mark}>
                  <KakaoMark size={28} />
                </span>
                <span className={s.mark}>
                  <NaverMark size={28} />
                </span>
                <span className={s.mark}>
                  <GoogleMark size={28} />
                </span>
              </div>
              <div className="stack" style={{ gap: 10, maxWidth: 360 }}>
                <SocialButton provider="kakao" href="#icons" />
                <SocialButton provider="naver" href="#icons" />
                <SocialButton provider="google" href="#icons" />
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <SocialButton provider="kakao" href="#icons" round />
                <SocialButton provider="naver" href="#icons" round />
                <SocialButton provider="google" href="#icons" round />
              </div>
            </Box>
            <Box title="카테고리 · 로고" note=".cat-tile 56px">
              <div className={s.cats}>
                {CATEGORIES.map((c) => (
                  <a key={c.icon} href="#icons" className={s.cat}>
                    <CategoryTile name={c.icon} />
                    <b>{c.label}</b>
                    <small>{c.caption}</small>
                    <span className={s.catFoot}>
                      <span>
                        매물 <b className="num">{c.count.toLocaleString('ko-KR')}</b>
                      </span>
                      <Icon name="arrow-right" size={16} />
                    </span>
                  </a>
                ))}
              </div>
              <div className="row" style={{ marginTop: 20, gap: 24 }}>
                <Logo href={undefined} />
                <span className={s.inkChip}>
                  <Logo href={undefined} tone="ink" size={30} />
                </span>
              </div>
            </Box>
          </div>
        </Section>

        <Section
          id="controls"
          no="04 · CONTROLS"
          title="버튼 · 입력 · 필터"
          lead="버튼 기본 높이 44px. 주 행동은 코발트 한 개만, 보조는 흰 버튼, 강조된 보조는 잉크. 필터 칩은 항상 “항목 + 값”을 함께 보여 줍니다."
        >
          <div className={s.grid2}>
            <Box title="버튼" note="<Button variant size />">
              <Label>VARIANT</Label>
              <div className="row">
                <Button>매물 38건 보기</Button>
                <Button variant="secondary">단지 정보</Button>
                <Button variant="soft">관심 단지</Button>
                <Button variant="ink" iconRight={<Icon name="arrow-right" size={18} />}>
                  지도에서 찾기
                </Button>
                <Button variant="ghost">초기화</Button>
                <Button variant="danger">허위매물 신고</Button>
                <Button disabled>등록 완료</Button>
                <Button loading>저장 중</Button>
              </div>
              <Label>SIZE · 36 / 44 / 56</Label>
              <div className="row">
                <Button size="sm">문의</Button>
                <Button>전화 문의</Button>
                <Button size="lg" iconLeft={<Icon name="home-up" size={20} />}>
                  내 집 내놓기
                </Button>
                <Button pill variant="secondary">
                  pill
                </Button>
              </div>
              <Label>ICON · 44 × 44</Label>
              <div className="row">
                <IconButton label="관심 매물에 추가">
                  <Icon name="heart" size={20} />
                </IconButton>
                <IconButton label="관심 매물에서 삭제" pressed>
                  <Icon name="heart" size={20} filled />
                </IconButton>
                <IconButton label="새 창으로 열기">
                  <Icon name="external-link" size={20} />
                </IconButton>
                <IconButton label="필터">
                  <Icon name="filter" size={20} />
                </IconButton>
                <Tooltip content="닫기 버튼이에요">
                  <IconButton label="닫기">
                    <Icon name="close" size={20} />
                  </IconButton>
                </Tooltip>
                <Spinner label="불러오는 중" />
              </div>
            </Box>
            <Box title="입력" note="<Input /> <Select /> <Textarea />">
              <div className={s.formGrid}>
                <Input
                  label="희망 매매가"
                  required
                  defaultValue="4억 2,000"
                  suffix="만원"
                  help="숫자만 입력하면 억/만으로 바꿔드려요"
                />
                <Input
                  label="전용 면적"
                  defaultValue="84.98"
                  suffix="㎡"
                  help="약 25.7평"
                  inputMode="decimal"
                />
                <Select
                  label="거래 방식"
                  defaultValue="SALE"
                  options={[
                    { value: 'SALE', label: '매매' },
                    { value: 'JEONSE', label: '전세' },
                    { value: 'MONTHLY', label: '월세' },
                  ]}
                />
                <Input
                  label="연락처"
                  defaultValue="010-12"
                  error="휴대폰 번호 11자리를 입력해 주세요"
                  inputMode="tel"
                />
                <Combobox
                  label="단지 검색"
                  placeholder="단지명을 입력하세요"
                  inputValue={combo}
                  onInputChange={setCombo}
                  onSelect={(o) => setCombo(o.label)}
                  options={RANKING.filter((r) => combo && r.name.includes(combo)).map((r) => ({
                    value: r.id,
                    label: r.name,
                    description: r.dong,
                  }))}
                  emptyText="일치하는 단지가 없어요"
                />
                <Textarea
                  label="상세 설명"
                  placeholder="채광, 수리 내역, 입주 가능 시기 등을 적어 주세요"
                  fieldClassName={s.span2}
                />
              </div>
              <Label>CHECK · RADIO · SWITCH</Label>
              <div className="row" style={{ gap: 20 }}>
                <Checkbox defaultChecked>남향만</Checkbox>
                <Checkbox>주차 가능</Checkbox>
                <Radio name="g-unit" defaultChecked>
                  평
                </Radio>
                <Radio name="g-unit">㎡</Radio>
                <Switch defaultChecked>매물 알림</Switch>
              </div>
              <RadioGroup
                label="공개 범위"
                name="g-scope"
                defaultValue="all"
                options={[
                  { value: 'all', label: '전체 지역 중개사' },
                  { value: 'picked', label: '선택한 중개사만' },
                ]}
              />
            </Box>
            <Box title="검색" note="<SearchField variant='hero' | 'pill' />">
              <SegmentedControl
                label="거래 유형"
                variant="pills"
                value={deal}
                onChange={setDeal}
                options={[
                  { value: 'all', label: '전체' },
                  { value: 'sale', label: '매매' },
                  { value: 'jeonse', label: '전세' },
                  { value: 'monthly', label: '월세' },
                  { value: 'presale', label: '분양권' },
                ]}
              />
              <SearchField
                className={s.gap12}
                label="지역 또는 단지명 검색"
                placeholder="지역 또는 단지명 (예: 신대지구, 오천 그린빌)"
                value={q}
                onChange={setQ}
                options={suggestions}
                onSelect={(o) => {
                  setQ(o.label);
                  toast(`${o.label} 선택`);
                }}
                onSubmit={(v) => toast({ message: `“${v}” 검색`, tone: 'info' })}
                emptyText="검색 결과가 없어요"
              />
              <SearchField
                className={s.gap12}
                variant="pill"
                label="헤더 검색"
                placeholder="지역 또는 단지명"
                value={q}
                onChange={setQ}
              />
              <div className={s.qrow}>
                <span className={s.qlabel}>많이 찾는</span>
                <Chip variant="quick" selected href="#controls">
                  신대지구
                </Chip>
                <Chip variant="quick" href="#controls">
                  오천지구
                </Chip>
                <Chip variant="quick" href="#controls">
                  연향동
                </Chip>
              </div>
            </Box>
            <Box title="탭 · 세그먼트 · 칩">
              <Tabs
                label="단지 목록"
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'freq', label: '자주 방문한 단지', count: 7 },
                  { value: 'fav', label: '관심 단지', count: 3 },
                  { value: 'map', label: '지도 내 단지' },
                ]}
              />
              <Label>SEGMENTED</Label>
              <div className="row">
                <SegmentedControl
                  label="면적 단위"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { value: 'py', label: '평' },
                    { value: 'sqm', label: '㎡' },
                  ]}
                />
                <SegmentedControl
                  label="정렬"
                  tone="ink"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'verified', label: '매물확인순' },
                    { value: 'price', label: '금액순' },
                    { value: 'year', label: '준공년순' },
                  ]}
                />
                <SegmentedControl
                  label="기간"
                  size="sm"
                  defaultValue="7"
                  options={[
                    { value: '7', label: '7일' },
                    { value: '30', label: '30일' },
                  ]}
                />
              </div>
              <Label>CHIP</Label>
              <div className="row" style={{ gap: 8 }}>
                <Chip
                  selected
                  onRemove={() => toast('신대지구 조건 삭제')}
                  removeLabel="신대지구 조건 삭제"
                >
                  신대지구
                </Chip>
                <Chip onClick={() => toast('연향 센트럴')}>연향 센트럴</Chip>
                <Chip onClick={() => toast('조례호수공원')}>조례호수공원</Chip>
                <Chip>순천대 원룸</Chip>
              </div>
            </Box>
          </div>
          <div className={s.filterbar}>
            <FilterDropdown
              field="거래"
              valueLabel={dealLabel(dealSet)}
              active={dealSet.length > 0}
              onOpen={() => setDraftDeal(dealSet)}
              onApply={() => setDealSet(draftDeal)}
              onReset={() => setDraftDeal([])}
            >
              {[
                ['SALE', '매매'],
                ['JEONSE', '전세'],
                ['MONTHLY', '월세'],
                ['PRESALE', '분양권'],
              ].map(([value, label]) => (
                <Checkbox
                  key={value}
                  checked={draftDeal.includes(value!)}
                  onChange={(e) =>
                    setDraftDeal(
                      e.target.checked
                        ? [...draftDeal, value!]
                        : draftDeal.filter((d) => d !== value),
                    )
                  }
                >
                  {label}
                </Checkbox>
              ))}
            </FilterDropdown>
            <FilterDropdown
              field="금액"
              valueLabel={formatPriceFilter(price[0], price[1] >= 100000 ? null : price[1])}
              active={price[0] > 0 || price[1] < 100000}
              onOpen={() => setDraftPrice(price)}
              onApply={() => setPrice(draftPrice)}
              onReset={() => setDraftPrice([0, 100000])}
              width={360}
            >
              <RangeSlider
                label="매매가"
                min={0}
                max={100000}
                step={5000}
                value={draftPrice}
                onChange={setDraftPrice}
                formatValue={(v) => (v === 0 ? '0' : formatManwon(v))}
                maxLabel="10억+"
              />
            </FilterDropdown>
            <FilterDropdown field="면적" valueLabel="전체">
              <p className="t-sm">면적 필터 내용</p>
            </FilterDropdown>
            <FilterDropdown field="방향" valueLabel="전체">
              <p className="t-sm">방향 필터 내용</p>
            </FilterDropdown>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Icon name="refresh" size={16} />}
              onClick={() => (setDealSet([]), setPrice([0, 100000]))}
            >
              초기화
            </Button>
          </div>
        </Section>

        <Section
          id="badges"
          no="05 · BADGES"
          title="배지 · 상태 · 매물 수"
          lead="거래유형 태그는 연한 바탕(목록)과 꽉 찬 바탕(지도·강조) 두 가지. 분/매/전/월 4칸 카운트는 어디서나 같은 컴포넌트를 씁니다."
        >
          <div className={s.grid2}>
            <Box title="거래유형 · 프리미엄 · 순위">
              <Label>DEAL · SOFT / SOLID</Label>
              <div className="row" style={{ gap: 8 }}>
                {(['sale', 'jeonse', 'monthly', 'presale'] as DealKind[]).map((d) => (
                  <DealBadge key={d} deal={d} />
                ))}
                <span style={{ width: 12 }} />
                {(['sale', 'jeonse', 'monthly', 'presale'] as DealKind[]).map((d) => (
                  <DealBadge key={d} deal={d} solid>
                    {d === 'presale' ? '분양' : undefined}
                  </DealBadge>
                ))}
              </div>
              <Label>분양권 PREMIUM · RANK DELTA</Label>
              <div className="row">
                <PremiumBadge amount={2700} />
                <PremiumBadge amount={-1200} />
                <RankDelta delta={2} />
                <RankDelta delta={-1} />
                <RankDelta delta={0} />
                <RankDelta delta="new" />
              </div>
              <Label>TRUST</Label>
              <div className="row">
                <VerifiedBadge date="26.11.22" />
                <BrokersBadge count={3} />
                <BrokersBadge count={3} light />
                <Tag variant="accent" icon={<Icon name="star" size={14} />}>
                  단지 전문
                </Tag>
              </div>
            </Box>
            <Box title="광고 · 관리자 상태 · 매물 수">
              <Label>AD LABEL</Label>
              <div className="row">
                <AdBadge />
                <span className={s.inkChip}>
                  <AdBadge onDark />
                </span>
                <Tag icon={<Icon name="image" size={14} />}>2480 × 440</Tag>
                <Badge>일반</Badge>
                <Badge tone="brand">내놓기</Badge>
                <Badge tone="accent">구하기</Badge>
                <Badge tone="danger">허위 가격</Badge>
              </div>
              <Label>STATUS PILL</Label>
              <div className="row" style={{ gap: 8 }}>
                <StatusPill tone="live">게시중</StatusPill>
                <StatusPill tone="scheduled">예약</StatusPill>
                <StatusPill tone="review">검수 대기</StatusPill>
                <StatusPill tone="ended">종료</StatusPill>
                <StatusPill tone="rejected">반려</StatusPill>
              </div>
              <Label>DEAL COUNT</Label>
              <div className="row">
                <DealCount counts={{ presale: 0, sale: 38, jeonse: 12, monthly: 6 }} />
                <DealCount counts={{ presale: 46, sale: 5, jeonse: 0, monthly: 2 }} />
                <span className={s.inkChip}>
                  <DealCount ink counts={{ presale: 0, sale: 38, jeonse: 12, monthly: 6 }} />
                </span>
              </div>
            </Box>
          </div>
        </Section>

        <Section
          id="cards"
          no="06 · CARDS"
          title="카드 · 목록 · 표"
          lead="매물 카드는 거래유형 라벨 → 큰 가격 → 단지·동 → 평·층·향 → 실매물 확인 순서로 읽힙니다. 공동중개는 “중개사 N곳”으로 한 번만 보여 줍니다."
        >
          <div className={s.cards4}>
            <ListingCard
              href="#cards"
              deal="sale"
              price="4억 4,500"
              title="신대 레이크파크 1단지"
              subtitle="103동"
              meta={['34평', '고/25층', '남향']}
              verifiedDate="26.11.22"
              brokerCount={3}
              favorite={!!fav.L01}
              onFavoriteChange={(v) => setFav((f) => ({ ...f, L01: v }))}
            />
            <ListingCard
              href="#cards"
              deal="presale"
              price="4억 1,900"
              premium={2700}
              title="선월 하이츠 2차"
              subtitle="205동"
              meta={['33평', '중/20층', '남동향']}
              verifiedDate="26.11.22"
              brokerCount={2}
              favorite={!!fav.L02}
              onFavoriteChange={(v) => setFav((f) => ({ ...f, L02: v }))}
            />
            <ListingCard
              href="#cards"
              deal="monthly"
              price="500/42"
              title="석현동 해오름빌"
              subtitle="순천대 정문 도보 6분"
              meta={['투룸', '3/4층', '2019년 준공']}
              verifiedDate="26.11.21"
              brokerCount={4}
              placeholder="villa"
              favorite={!!fav.R01}
              onFavoriteChange={(v) => setFav((f) => ({ ...f, R01: v }))}
            />
            <ListingCard
              href="#cards"
              deal="monthly"
              price="1,000/45"
              title="조례동 호수뷰 오피스텔"
              subtitle="조례호수공원 앞"
              meta={['원룸', '9/15층', '2018년 준공']}
              verifiedDate="26.11.20"
              brokerCount={1}
              placeholder="room"
              favorite={!!fav.R04}
              onFavoriteChange={(v) => setFav((f) => ({ ...f, R04: v }))}
            />
          </div>
          <div className={s.grid2} style={{ marginTop: 20 }}>
            <Box title="단지 행 · 지도 왼쪽 목록" note="<ComplexRow />">
              <div className="stack" style={{ gap: 4 }}>
                <ComplexRow
                  href="#cards"
                  selected
                  name="신대 레이크파크 1단지"
                  dong="해룡면 신대리"
                  meta="1,412세대 · 2019년 · 25·34·41평"
                  priceDeal="sale"
                  price={formatPriceRange(39000, 48500)}
                  counts={{ presale: 0, sale: 38, jeonse: 12, monthly: 6 }}
                />
                <ComplexRow
                  href="#cards"
                  name="선월 하이츠 2차"
                  dong="해룡면 선월리"
                  meta="1,120세대 · 2027.03 입주 · 25·33평"
                  priceDeal="presale"
                  price={formatPriceRange(33800, 43500)}
                  counts={{ presale: 46, sale: 5, jeonse: 0, monthly: 2 }}
                />
                <ComplexRow
                  href="#cards"
                  name="연향 센트럴"
                  dong="연향동"
                  meta="980세대 · 2016년 · 24·32평"
                  priceDeal="sale"
                  price={formatPriceRange(32000, 39500)}
                  counts={{ presale: 0, sale: 24, jeonse: 9, monthly: 5 }}
                />
              </div>
            </Box>
            <Box title="중개사무소 카드" note="<BrokerCard featured />">
              <div className="stack" style={{ gap: 12 }}>
                <BrokerCard
                  featured
                  name="신대중앙 공인중개사사무소"
                  specialty="신대 레이크파크 단지 전문"
                  meta={['대표 공인중개사 김서진 · 매물 62', '순천시 해룡면 신대1로 18, 105호']}
                  action={
                    <Button
                      size="sm"
                      href="tel:0610000000"
                      iconLeft={<Icon name="phone" size={16} />}
                    >
                      전화
                    </Button>
                  }
                />
                <BrokerCard
                  href="#cards"
                  name="호수공원 공인중개사사무소"
                  specialty="연향·조례 아파트 전문"
                  meta={['대표 공인중개사 한서윤 · 매물 46', '순천시 조례동 호수공원길 24, 1층']}
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      href="tel:0610000000"
                      iconLeft={<Icon name="phone" size={16} />}
                    >
                      전화
                    </Button>
                  }
                />
                <BrokerCard
                  href="#cards"
                  name="순천대정문 공인중개사사무소"
                  specialty="원룸·투룸 전문"
                  meta={['대표 공인중개사 최유나 · 매물 74', '순천시 석현동 대학로 15, 1층']}
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      href="tel:0610000000"
                      iconLeft={<Icon name="phone" size={16} />}
                    >
                      전화
                    </Button>
                  }
                />
              </div>
            </Box>
          </div>
          <div style={{ marginTop: 20 }}>
            <Table
              caption="사람들이 자주 찾는 단지 순위"
              rows={sortedRanking}
              rowKey={(r) => r.id}
              sort={tableSort}
              onSortChange={setTableSort}
              selectable
              selectedKeys={picked}
              onSelectionChange={setPicked}
              pagination={{ page, totalPages: 12, onChange: setPage }}
              columns={[
                {
                  key: 'rank',
                  header: '순위',
                  sortable: true,
                  width: 110,
                  cell: (r) => (
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <span className={r.rank === 1 ? `${s.rankN} ${s.rankTop}` : s.rankN}>
                        {r.rank}
                      </span>
                      <RankDelta delta={r.delta} />
                    </span>
                  ),
                },
                {
                  key: 'name',
                  header: '단지',
                  sortable: true,
                  cell: (r) => (
                    <span className={s.cellStack}>
                      <b>{r.name}</b>
                      <small>{r.dong}</small>
                    </span>
                  ),
                },
                {
                  key: 'presale',
                  header: '분양',
                  align: 'center',
                  dealTone: 'presale',
                  sortable: true,
                  cell: (r) => <span className={r.presale ? s.strong : s.zero}>{r.presale}</span>,
                },
                {
                  key: 'sale',
                  header: '매매',
                  align: 'center',
                  dealTone: 'sale',
                  sortable: true,
                  cell: (r) => <span className={r.sale ? s.strong : s.zero}>{r.sale}</span>,
                },
                {
                  key: 'jeonse',
                  header: '전세',
                  align: 'center',
                  dealTone: 'jeonse',
                  cell: (r) => <span className={r.jeonse ? s.strong : s.zero}>{r.jeonse}</span>,
                },
                {
                  key: 'monthly',
                  header: '월세',
                  align: 'center',
                  dealTone: 'monthly',
                  cell: (r) => <span className={r.monthly ? s.strong : s.zero}>{r.monthly}</span>,
                },
                {
                  key: 'recent',
                  header: '최근 거래',
                  align: 'right',
                  sortable: true,
                  cell: (r) => (
                    <span className={s.cellStack} style={{ alignItems: 'flex-end' }}>
                      <b className="num">{formatManwon(r.recent)}</b>
                      <small>{r.size}</small>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Section>

        <Section
          id="map"
          no="07 · MAP"
          title="지도 컴포넌트"
          lead="키가 없으면 StaticMapView(디자인의 순천 SVG)로, NEXT_PUBLIC_NAVER_MAP_KEY_ID 가 있으면 NaverMapView 로 같은 props 를 그립니다. 끌어서 이동, 휠·+/− 로 확대/축소."
        >
          <div className={s.mapFrame}>
            <MapView
              center={view.center}
              zoom={view.zoom}
              markers={MARKERS}
              selectedId={selected}
              ariaLabel="순천 아파트 지도 예시"
              onMarkerClick={(m) =>
                m.kind === 'cluster'
                  ? setView({ center: m.position, zoom: Math.min(16, view.zoom + 1) })
                  : setSelected(m.id)
              }
              onMapClick={() => setSelected(null)}
              onViewChange={(c) => {
                setView({ center: c.center, zoom: c.zoom });
                setBbox(
                  `${c.bounds.swLng.toFixed(3)},${c.bounds.swLat.toFixed(3)} → ${c.bounds.neLng.toFixed(3)},${c.bounds.neLat.toFixed(3)}`,
                );
              }}
            >
              <div className={s.mapTop}>
                <MapBreadcrumb
                  items={[{ label: '순천시' }, { label: '해룡면' }, { label: '신대리 전체' }]}
                />
                <MapSummary
                  className="only-lg"
                  title="신대리"
                  stats={[
                    { label: '단지', value: '9' },
                    { label: '매물', value: '412' },
                    { label: '평균', value: '1,180만', suffix: '/평' },
                  ]}
                />
              </div>
              <div className={s.mapLayer}>
                <SegmentedControl
                  label="지도 레이어"
                  defaultValue="listing"
                  options={[
                    { value: 'listing', label: '매물' },
                    { value: 'trade', label: '실거래가' },
                    { value: 'school', label: '학군' },
                    { value: 'dev', label: '개발' },
                  ]}
                />
              </div>
              {selected === 'C01' && (
                <MapSelectedCard
                  className={s.mapPop}
                  title="신대 레이크파크 1단지"
                  caption="해룡면 신대리 · 1,412세대 · 2019년"
                  tiles={[
                    { deal: 'sale', value: '3억 9,000~' },
                    { deal: 'jeonse', value: '2억 6,000~' },
                  ]}
                  actionLabel="매물 56건 보기"
                  actionHref="#map"
                  onClose={() => setSelected(null)}
                />
              )}
              <div className={s.mapTools}>
                <MapZoomControl
                  onZoomIn={() => setView((v) => ({ ...v, zoom: Math.min(21, v.zoom + 1) }))}
                  onZoomOut={() => setView((v) => ({ ...v, zoom: Math.max(6, v.zoom - 1) }))}
                />
                <MapToolButton
                  label="내 위치"
                  onClick={() => toast({ message: '내 위치로 이동', tone: 'info' })}
                >
                  <Icon name="locate" size={20} />
                </MapToolButton>
              </div>
            </MapView>
          </div>
          <p className="t-cap" style={{ marginTop: 8 }}>
            zoom {view.zoom} · center {view.center.lat.toFixed(4)}, {view.center.lng.toFixed(4)} ·
            bbox {bbox || '…'} · selected {selected ?? '없음'}
          </p>
        </Section>

        <Section
          id="overlays"
          no="08 · OVERLAYS"
          title="모달 · 드로어 · 시트 · 토스트"
          lead="포커스는 레이어 안에 갇히고, Esc·바깥 클릭으로 닫히며, 닫으면 연 버튼으로 돌아갑니다."
        >
          <Box title="열어 보기">
            <div className="row">
              <Button variant="secondary" onClick={() => setModal(true)}>
                모달
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(true)}>
                확인 대화상자
              </Button>
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                드로어
              </Button>
              <Button variant="secondary" onClick={() => setSheet(true)}>
                바텀 시트
              </Button>
              <Popover
                label="공유"
                trigger={(p) => (
                  <Button variant="secondary" iconLeft={<Icon name="share" size={18} />} {...p}>
                    팝오버
                  </Button>
                )}
              >
                {(close) => (
                  <div className="stack" style={{ gap: 8, width: 220 }}>
                    <b className="t-title">공유하기</b>
                    <Button
                      variant="soft"
                      size="sm"
                      block
                      iconLeft={<Icon name="copy" size={16} />}
                      onClick={() => (close(), toast('링크를 복사했어요'))}
                    >
                      링크 복사
                    </Button>
                  </div>
                )}
              </Popover>
              <Button
                onClick={() =>
                  toast({
                    message: '관심 매물에 담았어요',
                    action: { label: '보러 가기', href: '#overlays' },
                  })
                }
              >
                토스트
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  toast({ message: '저장하지 못했어요. 다시 시도해 주세요.', tone: 'error' })
                }
              >
                오류 토스트
              </Button>
            </div>
          </Box>
          <div className={s.grid2} style={{ marginTop: 20 }}>
            <SheetSurface
              className={s.sheetDemo}
              header={
                <>
                  <b className="t-title">
                    매물 <span style={{ color: 'var(--brand)' }}>38</span>
                  </b>
                  <span className="t-sm">확인일순</span>
                </>
              }
            >
              <p className="t-sm" style={{ padding: '0 16px 16px' }}>
                모바일 지도 위에 얹는 비모달 시트 표면 (&lt;SheetSurface /&gt;)
              </p>
            </SheetSurface>
            <div className={s.sheetDemo}>
              <CtaBar>
                <IconButton label="관심 매물에 추가" size={52} data-icon>
                  <Icon name="heart" size={22} />
                </IconButton>
                <Button variant="secondary" iconLeft={<Icon name="chat" size={18} />}>
                  문의
                </Button>
                <Button iconLeft={<Icon name="phone" size={18} />}>전화</Button>
              </CtaBar>
            </div>
          </div>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title="허위매물 신고"
            description="신고 내용은 운영자가 24시간 안에 확인합니다."
            footer={
              <>
                <Button variant="secondary" onClick={() => setModal(false)}>
                  취소
                </Button>
                <Button onClick={() => (setModal(false), toast('신고를 접수했어요'))}>
                  신고하기
                </Button>
              </>
            }
          >
            <Select
              label="신고 사유"
              options={[
                { value: 'price', label: '가격이 달라요' },
                { value: 'sold', label: '이미 거래된 매물이에요' },
              ]}
            />
          </Modal>
          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            onConfirm={() => (setConfirm(false), toast('삭제했어요'))}
            title="이 배너를 삭제할까요?"
            description="삭제하면 통계도 함께 사라지고 되돌릴 수 없어요."
            confirmLabel="삭제"
            danger
          />
          <Drawer
            open={drawer}
            onClose={() => setDrawer(false)}
            title="배너 수정"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDrawer(false)}>
                  취소
                </Button>
                <Button onClick={() => setDrawer(false)}>저장</Button>
              </>
            }
          >
            <div className="stack">
              <Input label="배너 제목" defaultValue="연향들 더 퍼스트 12월 견본주택 오픈" />
              <Dropzone
                onFiles={(f) => setFiles(f.map((x) => x.name))}
                accept="image/*"
                hint="2480 × 440 · JPG/PNG/WebP · 2MB 이하"
              />
            </div>
          </Drawer>
          <Drawer open={sheet} onClose={() => setSheet(false)} side="bottom" title="정렬">
            <RadioGroup
              label="정렬 기준"
              hideLabel
              name="g-sort"
              direction="column"
              defaultValue="verified"
              options={[
                { value: 'verified', label: '실매물 확인순' },
                { value: 'price', label: '낮은 가격순' },
                { value: 'area', label: '넓은 면적순' },
              ]}
            />
          </Drawer>
        </Section>

        <Section
          id="feedback"
          no="09 · FEEDBACK"
          title="로딩 · 빈 상태 · 오류 · 진행"
          lead="모든 데이터 화면은 스켈레톤, 빈 상태, 오류 상태를 갖습니다."
        >
          <div className={s.grid3}>
            <Box title="Skeleton">
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <Skeleton circle width={44} height={44} />
                <div style={{ flex: 1 }}>
                  <SkeletonText lines={3} />
                </div>
              </div>
              <div style={{ marginTop: 16, maxWidth: 260 }}>
                <ListingCardSkeleton />
              </div>
            </Box>
            <Box title="EmptyState">
              <EmptyState
                compact
                icon="home-search"
                title="조건에 맞는 매물이 없어요"
                description="필터를 줄이거나 지도를 넓혀 보세요."
                action={
                  <Button size="sm" variant="soft">
                    필터 초기화
                  </Button>
                }
              />
            </Box>
            <Box title="ErrorState">
              <ErrorState
                compact
                onRetry={() => toast({ message: '다시 불러오는 중', tone: 'info' })}
                code="req_8f3a21"
              />
            </Box>
          </div>
          <div className={s.grid2} style={{ marginTop: 20 }}>
            <Box title="Breadcrumb · Stepper · Pagination">
              <Breadcrumb
                items={[
                  { label: '홈', href: '#feedback' },
                  { label: '아파트·분양권', href: '#feedback' },
                  { label: '신대 레이크파크 1단지' },
                ]}
              />
              <div style={{ margin: '20px 0' }}>
                <Stepper
                  label="내놓기 단계"
                  current={1}
                  steps={[
                    { label: '매물 유형' },
                    { label: '주소' },
                    { label: '가격·면적' },
                    { label: '사진' },
                    { label: '연락처' },
                  ]}
                />
              </div>
              <Stepper
                label="내놓기 안내"
                orientation="vertical"
                current={0}
                steps={[
                  {
                    label: '매물 정보 남기기',
                    description: '주소 · 희망 가격 · 입주 가능일, 3분이면 끝나요',
                  },
                  {
                    label: '동네 중개사 제안 받기',
                    description: '그 단지를 잘 아는 중개사무소가 먼저 연락드려요',
                  },
                ]}
              />
              <div style={{ marginTop: 20 }}>
                <Pagination page={page} totalPages={12} onChange={setPage} />
              </div>
            </Box>
            <Box title="Dropzone · Avatar · 사진 자리표시">
              <Dropzone
                onFiles={(f) => setFiles(f.map((x) => x.name))}
                multiple
                accept="image/*"
                hint="JPG/PNG/WebP · 장당 10MB 이하 · 최대 20장"
              />
              {files.length > 0 && (
                <p className="t-cap" style={{ marginTop: 8 }}>
                  선택됨: {files.join(', ')}
                </p>
              )}
              <div className="row" style={{ marginTop: 16 }}>
                <Avatar name="정다은" />
                <Avatar name="운영자" tone="soft" />
                <Avatar name="신대중앙" tone="neutral" square size={44} />
                <AvatarStack names={['신대중앙', '호수공원', '연향센트럴', '오천그린', '왕지숲']} />
              </div>
              <div className={s.photos}>
                {PHOTO_KINDS.map((k) => (
                  <span key={k}>
                    <PhotoPlaceholder kind={k} />
                    <small>{k}</small>
                  </span>
                ))}
              </div>
            </Box>
          </div>
        </Section>

        <Section
          id="data"
          no="10 · DATA"
          title="KPI · 차트 · 광고 프레임 · 패널"
          lead="관리자와 단지 상세가 같은 차트·타일을 씁니다."
        >
          <div className={s.kpis}>
            <StatTile
              label="오늘 방문자"
              value="3,482"
              unit="명"
              icon={<Icon name="eye" size={18} />}
              detail={
                <>
                  <Delta direction="up" good>
                    8.6%
                  </Delta>
                  어제 3,206명
                </>
              }
            />
            <StatTile
              label="신규 매물"
              value="47"
              unit="건"
              icon={<Icon name="building" size={18} />}
              detail={
                <>
                  <Delta direction="up" good>
                    12건
                  </Delta>
                  어제 대비 · 검수 대기 12
                </>
              }
            />
            <StatTile
              label="내놓기·구하기 요청"
              value="5"
              unit="건"
              icon={<Icon name="home-up" size={18} />}
              iconTone="accent"
              detail={
                <>
                  <Badge tone="brand">내놓기 3</Badge>
                  <Badge tone="accent">구하기 2</Badge>
                </>
              }
            />
            <StatTile
              label="중개사 승인 대기"
              value="4"
              unit="곳"
              icon={<Icon name="shield" size={18} />}
              iconTone="accent"
              detail={
                <span style={{ color: 'var(--warn)', fontWeight: 700 }}>
                  가장 오래된 신청 3일째
                </span>
              }
            />
          </div>
          <div className={s.grid2} style={{ marginTop: 20 }}>
            <Panel
              title="방문 추이"
              description="순 방문자 · 하루 단위"
              actions={
                <SegmentedControl
                  label="기간"
                  size="sm"
                  defaultValue="7"
                  options={[
                    { value: '7', label: '7일' },
                    { value: '30', label: '30일' },
                  ]}
                />
              }
            >
              <LineChart
                label="최근 7일 방문자 추이"
                labels={DAYS}
                series={[
                  { name: '최근 7일', values: VISITS, area: true },
                  { name: '직전 7일', values: VISITS_PREV, dashed: true },
                ]}
              />
            </Panel>
            <Panel
              title="배너 클릭"
              count={<span className="num">1,126</span>}
              description="AD-01 · 일별"
              footer="평균 클릭률 2.3%"
            >
              <BarChart
                label="배너 일별 클릭 수"
                name="클릭"
                labels={DAYS}
                values={[142, 151, 139, 160, 188, 171, 175]}
                highlightIndex={6}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <Sparkline
                  label="34평 실거래가 추이, 상승"
                  values={[41000, 41500, 41200, 42300, 42800, 43500]}
                />
                <Sparkline
                  label="24평 실거래가 추이, 하락"
                  values={[26000, 25800, 25900, 25400, 25200]}
                  color="var(--down)"
                />
              </div>
            </Panel>
          </div>
          <div style={{ marginTop: 20 }}>
            <AdFrame slot="main" label="연향들 더 퍼스트 견본주택 오픈" href="#data">
              <span className={s.adCopy}>
                <small>연향들 도시개발구역 · 민간분양</small>
                <b>
                  연향들 더 퍼스트
                  <br />
                  12월 견본주택 오픈
                </b>
                <span>전용 84㎡ · 612세대 · 2029년 입주 예정</span>
              </span>
            </AdFrame>
          </div>
        </Section>
        <PatternsSection />
      </div>
    </div>
  );
}
