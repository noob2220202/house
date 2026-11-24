import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AgencyLogo,
  BackLink,
  BarChart,
  Button,
  Callout,
  ChoiceChip,
  FieldError,
  FormRow,
  FormSection,
  HelpLine,
  ListSearchField,
  MoneyInput,
  ProviderTile,
  agencyLogoTone,
  manwonHint,
  useDebouncedValue,
  Chip,
  DealBadge,
  DealCount,
  FilterDropdown,
  Icon,
  ICON_NAMES,
  Input,
  ListingCard,
  Modal,
  Pagination,
  PremiumBadge,
  RankDelta,
  SearchField,
  SegmentedControl,
  Table,
  Tabs,
  ToastProvider,
  cx,
  dealKindOf,
  niceTicks,
  paginationRange,
  useToast,
  type TableSort,
} from '../index';

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, undefined, 'b', null, 0, 'c')).toBe('a b c');
  });
});

describe('Icon', () => {
  it('has the full design-system icon set', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(52);
    for (const name of [
      'search',
      'map-pin',
      'heart',
      'home-up',
      'home-search',
      'check-circle',
      'megaphone',
    ] as const) {
      expect(ICON_NAMES).toContain(name);
    }
  });
  it('is decorative by default and labelled on request', () => {
    const { container, rerender } = render(<Icon name="search" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Icon name="search" label="검색" />);
    expect(screen.getByRole('img', { name: '검색' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('renders a button and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>매물 38건 보기</Button>);
    await userEvent.click(screen.getByRole('button', { name: '매물 38건 보기' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('blocks clicks and announces busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        저장
      </Button>,
    );
    const btn = screen.getByRole('button', { name: '저장' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('renders a link when href is set', () => {
    render(<Button href="/map/apt">지도에서 찾기</Button>);
    expect(screen.getByRole('link', { name: '지도에서 찾기' })).toHaveAttribute('href', '/map/apt');
  });
});

describe('Input', () => {
  it('wires label, required and error for assistive tech', () => {
    render(
      <Input
        label="연락처"
        required
        error="휴대폰 번호 11자리를 입력해 주세요"
        defaultValue="010-12"
      />,
    );
    const input = screen.getByLabelText(/연락처/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(screen.getByRole('alert')).toHaveTextContent('휴대폰 번호 11자리를 입력해 주세요');
    expect(input).toHaveAccessibleDescription('휴대폰 번호 11자리를 입력해 주세요');
  });
});

describe('Badges', () => {
  it('labels deal types and maps backend enums', () => {
    render(<DealBadge deal="presale" />);
    expect(screen.getByText('분양권')).toBeInTheDocument();
    expect(dealKindOf('JEONSE')).toBe('jeonse');
    expect(dealKindOf('MONTHLY')).toBe('monthly');
    expect(dealKindOf('PRESALE')).toBe('presale');
    expect(dealKindOf('SALE')).toBe('sale');
  });
  it('formats 분양권 premium with sign', () => {
    const { rerender } = render(<PremiumBadge amount={2700} />);
    expect(screen.getByText('P +2,700')).toBeInTheDocument();
    rerender(<PremiumBadge amount={-1200} />);
    expect(screen.getByText('P -1,200')).toBeInTheDocument();
  });
  it('describes rank movement', () => {
    render(<RankDelta delta={-2} />);
    expect(screen.getByLabelText('2계단 하락')).toBeInTheDocument();
  });
  it('exposes the 4-cell deal count as one labelled image', () => {
    render(<DealCount counts={{ presale: 0, sale: 38, jeonse: 12, monthly: 6 }} />);
    expect(
      screen.getByRole('img', { name: '분양 0건, 매매 38건, 전세 12건, 월세 6건' }),
    ).toBeInTheDocument();
  });
});

describe('Chip', () => {
  it('toggles with aria-pressed and supports removal', async () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <>
        <Chip selected onClick={onClick}>
          신대지구
        </Chip>
        <Chip onRemove={onRemove} removeLabel="연향 센트럴 삭제">
          연향 센트럴
        </Chip>
      </>,
    );
    expect(screen.getByRole('button', { name: '신대지구' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: '연향 센트럴 삭제' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('SegmentedControl', () => {
  it('selects with click and arrow keys', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="면적 단위"
        options={[
          { value: 'py', label: '평' },
          { value: 'sqm', label: '㎡' },
        ]}
        defaultValue="py"
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: '면적 단위' });
    expect(within(group).getByRole('radio', { name: '평' })).toBeChecked();
    await userEvent.click(within(group).getByRole('radio', { name: '㎡' }));
    expect(onChange).toHaveBeenLastCalledWith('sqm');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('py');
  });
});

describe('Tabs', () => {
  it('follows the tabs pattern', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="단지 목록"
        items={[
          { value: 'freq', label: '자주 방문한 단지', count: 7 },
          { value: 'fav', label: '관심 단지', count: 3 },
        ]}
        onChange={onChange}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(tabs[1]!);
    expect(onChange).toHaveBeenCalledWith('fav');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  });
  it('renders navigation links when items have href', () => {
    render(
      <Tabs
        label="매물 종류"
        value="apt"
        items={[
          { value: 'apt', label: '아파트·분양권', href: '/map/apt' },
          { value: 'oneroom', label: '원룸·투룸', href: '/map/oneroom' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: '아파트·분양권' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('Pagination', () => {
  it('computes ranges with gaps', () => {
    expect(paginationRange(1, 1)).toEqual([1]);
    expect(paginationRange(1, 5)).toEqual([1, 2, null, 5]);
    expect(paginationRange(5, 20)).toEqual([1, null, 4, 5, 6, null, 20]);
    expect(paginationRange(20, 20)).toEqual([1, null, 19, 20]);
  });
  it('marks the current page and disables prev on the first page', async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={8} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '1 페이지' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByLabelText('이전 페이지')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('Table', () => {
  interface Row {
    id: string;
    name: string;
    sale: number;
  }
  const rows: Row[] = [
    { id: 'c1', name: '신대 레이크파크 1단지', sale: 38 },
    { id: 'c2', name: '연향 센트럴', sale: 24 },
  ];
  function Demo() {
    const [sort, setSort] = useState<TableSort | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <>
        <Table
          caption="단지 순위"
          rows={rows}
          rowKey={(r) => r.id}
          sort={sort}
          onSortChange={setSort}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          columns={[
            { key: 'name', header: '단지', cell: (r) => r.name },
            {
              key: 'sale',
              header: '매매',
              cell: (r) => r.sale,
              sortable: true,
              align: 'right',
              dealTone: 'sale',
            },
          ]}
        />
        <output>{selected.join(',')}</output>
      </>
    );
  }
  it('sorts via header button with aria-sort', async () => {
    render(<Demo />);
    const header = screen.getByRole('columnheader', { name: /매매/ });
    expect(header).toHaveAttribute('aria-sort', 'none');
    await userEvent.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'descending');
  });
  it('selects rows and all rows', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('checkbox', { name: '1번째 행 선택' }));
    expect(screen.getByRole('status')).toHaveTextContent('c1');
    await userEvent.click(screen.getByRole('checkbox', { name: '현재 페이지 전체 선택' }));
    expect(screen.getByRole('status')).toHaveTextContent('c1,c2');
  });
  it('shows the empty state', () => {
    render(
      <Table
        caption="빈 표"
        rows={[]}
        rowKey={(r: Row) => r.id}
        columns={[{ key: 'name', header: '단지', cell: (r) => r.name }]}
      />,
    );
    expect(screen.getByText('표시할 항목이 없어요')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('is a labelled modal dialog that closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="허위매물 신고" description="신고 사유를 선택해 주세요.">
        <button type="button">확인</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: '허위매물 신고' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('신고 사유를 선택해 주세요.');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="닫힘" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('FilterDropdown', () => {
  it('opens a panel and applies', async () => {
    const onApply = vi.fn();
    render(
      <FilterDropdown field="거래" valueLabel="전체" onApply={onApply} onReset={() => {}}>
        <p>옵션</p>
      </FilterDropdown>,
    );
    const chip = screen.getByRole('button', { name: /거래/ });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(chip);
    expect(screen.getByRole('dialog', { name: '거래 필터' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SearchField', () => {
  it('navigates suggestions with the keyboard and selects', async () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    function Demo() {
      const [q, setQ] = useState('');
      return (
        <SearchField
          label="지역 또는 단지명 검색"
          value={q}
          onChange={setQ}
          onSubmit={onSubmit}
          onSelect={onSelect}
          options={
            q
              ? [
                  { value: 'c1', label: '신대 레이크파크 1단지' },
                  { value: 'c6', label: '신대 레이크파크 3단지' },
                ]
              : []
          }
        />
      );
    }
    render(<Demo />);
    const input = screen.getByRole('combobox', { name: '지역 또는 단지명 검색' });
    await userEvent.type(input, '신대');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'c6' }));
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('신대');
  });
});

describe('ListingCard', () => {
  it('exposes one link, the price and a labelled favourite toggle', async () => {
    const onFavoriteChange = vi.fn();
    render(
      <ListingCard
        href="/listing/L01"
        deal="sale"
        price="4억 4,500"
        title="신대 레이크파크 1단지"
        subtitle="103동"
        meta={['34평', '고/25층', '남향']}
        verifiedDate="26.11.22"
        brokerCount={3}
        onFavoriteChange={onFavoriteChange}
      />,
    );
    expect(screen.getByRole('link', { name: /신대 레이크파크 1단지/ })).toHaveAttribute(
      'href',
      '/listing/L01',
    );
    expect(screen.getByText('4억 4,500')).toBeInTheDocument();
    expect(screen.getByText('중개사 3곳')).toBeInTheDocument();
    expect(screen.getByText('실매물 확인 26.11.22')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: '신대 레이크파크 1단지 관심 매물에 추가' }),
    );
    expect(onFavoriteChange).toHaveBeenCalledWith(true);
  });
});

describe('Toast', () => {
  it('shows and dismisses a toast', async () => {
    function Demo() {
      const { toast } = useToast();
      return (
        <button
          type="button"
          onClick={() => toast({ message: '관심 매물에 담았어요', duration: 0 })}
        >
          담기
        </button>
      );
    }
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: '담기' }));
    expect(screen.getByText('관심 매물에 담았어요')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByText('관심 매물에 담았어요')).not.toBeInTheDocument();
  });
});

describe('niceTicks', () => {
  it('returns rounded ticks covering the range', () => {
    expect(niceTicks(0, 4500, 3)).toEqual([0, 2000, 4000, 6000]);
    const ticks = niceTicks(3206, 3890, 3);
    expect(ticks[0]).toBeLessThanOrEqual(3206);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(3890);
  });
});

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('returns the value once it stopped changing', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ v: 'abc' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('abc');
  });
});

describe('Callout', () => {
  it('is a static note by default with a tone icon and title', () => {
    const { container } = render(
      <Callout tone="warn" title="확인이 필요해요">
        등기부등본과 소유자 이름이 달라요.
      </Callout>,
    );
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('data-tone', 'warn');
    expect(within(note).getByText('확인이 필요해요')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('announces when live (status, or alert for danger) and can drop the icon', () => {
    const { container, rerender } = render(
      <Callout live icon={null}>
        저장했어요
      </Callout>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('저장했어요');
    expect(container.querySelector('svg')).toBeNull();
    rerender(
      <Callout live tone="danger">
        반려됐어요
      </Callout>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('반려됐어요');
  });
});

describe('FormSection / FormRow', () => {
  it('names the fieldset by its legend and wires label, required and error', () => {
    render(
      <FormSection letter="A" title="매물 기본 정보" note="* 필수 항목">
        <FormRow
          label="연락처"
          htmlFor="phone"
          required
          help="중개사에게만 공개돼요"
          error="휴대폰 번호를 입력해 주세요."
          errorId="phone-error"
          labelAside={<span>명시사항</span>}
        >
          <input id="phone" aria-describedby="phone-error" />
        </FormRow>
      </FormSection>,
    );
    expect(screen.getByRole('group', { name: /매물 기본 정보/ })).toBeInTheDocument();
    const input = screen.getByLabelText(/연락처/);
    // The visual * is aria-hidden; screen readers hear "연락처 (필수)".
    expect(input).toHaveAccessibleName(/^연락처\s?\(필수\)$/);
    expect(input).toHaveAccessibleDescription('휴대폰 번호를 입력해 주세요.');
    const err = screen.getByRole('alert');
    expect(err).toHaveAttribute('id', 'phone-error');
    expect(err).toHaveAttribute('data-field-error');
    expect(screen.getByText('명시사항')).toBeInTheDocument();
  });
  it('labels a group through labelId', () => {
    render(
      <FormRow label="거래 형태" labelId="l-deal">
        <div role="radiogroup" aria-labelledby="l-deal" />
      </FormRow>,
    );
    expect(screen.getByRole('radiogroup', { name: '거래 형태' })).toBeInTheDocument();
  });
  it('renders FieldError and HelpLine', () => {
    const { container } = render(
      <>
        <FieldError id="e1">필수 항목이에요</FieldError>
        <HelpLine icon="lock">연락처는 공개되지 않아요</HelpLine>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'e1');
    expect(screen.getByText('연락처는 공개되지 않아요')).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });
});

describe('ChoiceChip', () => {
  it('works as a radio group with the keyboard', async () => {
    function Demo() {
      const [v, setV] = useState('SALE');
      return (
        <div role="radiogroup" aria-label="거래 형태">
          {(['SALE', 'JEONSE', 'MONTHLY'] as const).map((d) => (
            <ChoiceChip
              key={d}
              type="radio"
              name="deal"
              value={d}
              checked={v === d}
              onChange={() => setV(d)}
              hint={d === 'MONTHLY' ? '보증금 + 월세' : undefined}
            >
              {d}
            </ChoiceChip>
          ))}
        </div>
      );
    }
    render(<Demo />);
    const sale = screen.getByRole('radio', { name: 'SALE' });
    expect(sale).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /MONTHLY/ }));
    expect(screen.getByRole('radio', { name: /MONTHLY/ })).toBeChecked();
    expect(sale).not.toBeChecked();
  });
  it('shows a check on a selected checkbox and respects disabled', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <ChoiceChip type="checkbox" name="opt" checked={false} onChange={onChange}>
        주차
      </ChoiceChip>,
    );
    expect(container.querySelector('svg')).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: '주차' }));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(
      <ChoiceChip type="checkbox" name="opt" checked onChange={onChange} disabled>
        주차
      </ChoiceChip>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: '주차' })).toBeDisabled();
  });
});

describe('MoneyInput', () => {
  function Demo({ initial = null, max }: { initial?: number | null; max?: number }) {
    const [v, setV] = useState<number | null>(initial);
    return (
      <>
        <MoneyInput
          id="price"
          label="매매가"
          value={v}
          onValueChange={setV}
          hint={manwonHint}
          steps={[10000, 1000]}
          max={max}
        />
        <output data-testid="value">{v === null ? 'null' : v}</output>
        <button type="button" onClick={() => setV(30000)}>
          3억으로
        </button>
      </>
    );
  }

  it('formats digits while typing and reads the amount aloud', async () => {
    render(<Demo />);
    const input = screen.getByRole('textbox', { name: /매매가/ });
    await userEvent.type(input, '44500');
    expect(input).toHaveValue('44,500');
    expect(screen.getByTestId('value')).toHaveTextContent('44500');
    expect(document.getElementById('price-readout')).toHaveAttribute('aria-live', 'polite');
    expect(document.getElementById('price-readout')).toHaveTextContent('= 4억 4,500만원');
    expect(input).toHaveAccessibleDescription('만원');
  });

  it('accepts "4억 4,500" and normalises it on blur', async () => {
    render(<Demo />);
    const input = screen.getByRole('textbox', { name: /매매가/ });
    await userEvent.type(input, '4억 4,500');
    expect(input).toHaveValue('4억 4,500');
    expect(screen.getByTestId('value')).toHaveTextContent('44500');
    await userEvent.tab();
    expect(input).toHaveValue('44,500');
  });

  it('adds quick steps, clears, follows outside changes and clamps to max', async () => {
    render(<Demo max={50000} />);
    const input = screen.getByRole('textbox', { name: /매매가/ });
    await userEvent.click(screen.getByRole('button', { name: '1억원 더하기' }));
    await userEvent.click(screen.getByRole('button', { name: '1,000만원 더하기' }));
    expect(input).toHaveValue('11,000');
    await userEvent.click(screen.getByRole('button', { name: '3억으로' }));
    expect(input).toHaveValue('30,000');
    await userEvent.clear(input);
    await userEvent.type(input, '99999');
    expect(input).toHaveValue('50,000');
    expect(screen.getByTestId('value')).toHaveTextContent('50000');
    await userEvent.click(screen.getByRole('button', { name: '금액 지우기' }));
    expect(input).toHaveValue('');
    expect(screen.getByTestId('value')).toHaveTextContent('null');
  });

  it('flags unparsable text after blur and forwards the ref', async () => {
    const ref = createRef<HTMLInputElement>();
    const onValueChange = vi.fn();
    render(
      <MoneyInput
        id="dep"
        value={null}
        onValueChange={onValueChange}
        ref={ref}
        inputProps={{ 'aria-label': '보증금', name: 'deposit' }}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toHaveAttribute('name', 'deposit');
    const input = screen.getByRole('textbox', { name: '보증금' });
    await userEvent.type(input, '4억x');
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('금액을 숫자로 입력해 주세요');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('ProviderTile', () => {
  it('is decorative unless labelled and accepts backend enum values', () => {
    const { container, rerender } = render(<ProviderTile provider="kakao" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveAttribute('data-provider', 'kakao');
    rerender(<ProviderTile provider="NAVER" size="lg" label="네이버 계정 연결됨" />);
    expect(screen.getByRole('img', { name: '네이버 계정 연결됨' })).toHaveAttribute(
      'data-provider',
      'naver',
    );
  });
});

describe('AgencyLogo', () => {
  it('shows the uploaded image when there is one', () => {
    render(
      <AgencyLogo
        name="호수공원 공인중개사사무소"
        seed="A01"
        image={<img alt="" src="/l.png" />}
      />,
    );
    expect(document.querySelector('img')).toHaveAttribute('src', '/l.png');
    expect(document.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'image');
  });
  it('picks the same fallback for the same office on every page', () => {
    const seed = Array.from({ length: 40 }, (_, i) => `office-${i}`).find(
      (s) => agencyLogoTone(s) !== 'art',
    )!;
    const { container } = render(
      <>
        <AgencyLogo name="신대 부동산" seed={seed} size={56} />
        <AgencyLogo name="신대 부동산" seed={seed} size={88} shape="round" fallback="initials" />
      </>,
    );
    const [small, large] = Array.from(container.querySelectorAll('[data-tone]'));
    expect(small).toHaveAttribute('data-tone', agencyLogoTone(seed));
    expect(large).toHaveAttribute('data-tone', agencyLogoTone(seed));
    expect(small).toHaveTextContent(/^신$/);
    expect(large).toHaveTextContent(/^신대$/);
    expect(large).toHaveStyle({ width: '88px', borderRadius: '50%' });
  });
  it('draws the office illustration for art offices and when forced', () => {
    const artSeed = Array.from({ length: 40 }, (_, i) => `office-${i}`).find(
      (s) => agencyLogoTone(s) === 'art',
    )!;
    const { container } = render(
      <>
        <AgencyLogo name="연향 공인중개사" seed={artSeed} />
        <AgencyLogo name="연향 공인중개사" seed="anything" fallback="art" label="연향 로고" />
      </>,
    );
    const logos = container.querySelectorAll('[data-tone="art"]');
    expect(logos).toHaveLength(2);
    expect(logos[0]?.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('img', { name: '연향 로고' })).toBeInTheDocument();
  });
});

describe('ListSearchField', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('commits after a typing pause, at once on Enter and on clear', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onSearch = vi.fn();
    render(<ListSearchField label="회원 검색" value="" onSearch={onSearch} delay={300} />);
    const box = screen.getByRole('searchbox', { name: '회원 검색' });
    expect(screen.queryByRole('combobox')).toBeNull();
    await user.type(box, ' 김순천 ');
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).toHaveBeenLastCalledWith('김순천', 'typing');
    await user.type(box, '2{Enter}');
    expect(onSearch).toHaveBeenLastCalledWith('김순천 2', 'submit');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onSearch).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(onSearch).toHaveBeenLastCalledWith('', 'submit');
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
  });
  it('follows outside changes without overwriting what is being typed', async () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <ListSearchField label="검색" value="" onSearch={onSearch} collapsible />,
    );
    const box = screen.getByRole('searchbox', { name: '검색' });
    await userEvent.type(box, '신대{Enter}');
    expect(onSearch).toHaveBeenLastCalledWith('신대', 'submit');
    await userEvent.type(box, ' 1');
    rerender(<ListSearchField label="검색" value="신대" onSearch={onSearch} collapsible />);
    expect(box).toHaveValue('신대 1');
    rerender(<ListSearchField label="검색" value="" onSearch={onSearch} collapsible />);
    expect(box).toHaveValue('');
    fireEvent.change(box, { target: { value: '왕지' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box).toHaveValue('');
  });
});

describe('BackLink', () => {
  it('renders a link with a chevron and accepts a link component', () => {
    const Custom = ({
      href,
      className,
      children,
    }: {
      href: string;
      className?: string;
      children?: ReactNode;
    }) => (
      <a href={href} className={className} data-custom="">
        {children}
      </a>
    );
    render(
      <BackLink href="/banners" linkAs={Custom}>
        배너 목록
      </BackLink>,
    );
    const link = screen.getByRole('link', { name: '배너 목록' });
    expect(link).toHaveAttribute('href', '/banners');
    expect(link).toHaveAttribute('data-custom');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Charts data table', () => {
  it('wraps the table in the sr-only box (a table cannot shrink, so it must not carry .sr-only)', () => {
    const { container } = render(
      <BarChart label="월별 거래량" name="거래" labels={['9월', '10월']} values={[12, 18]} />,
    );
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table).not.toHaveAttribute('class');
    expect(table?.parentElement).toHaveClass('sr-only');
    expect(table?.parentElement?.tagName).toBe('DIV');
  });
});
