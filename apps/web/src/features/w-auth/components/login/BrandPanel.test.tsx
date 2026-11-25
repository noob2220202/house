import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BrandPanelFacts } from '../../lib/brand-facts';
import { BrandFloatCards, BrandPanel } from './BrandPanel';

vi.mock('next/image', () => ({ default: () => null }));

const SAMPLE_WORDS = /레이크파크|103동|4억 4,500|신대·선월|12곳|방금/;

describe('<BrandPanel>', () => {
  it('renders no sample listing or count of its own', () => {
    const { container } = render(<BrandPanel />);
    expect(container.textContent).not.toMatch(SAMPLE_WORDS);
    expect(screen.queryByTestId('brand-listing-card')).not.toBeInTheDocument();
  });
});

describe('<BrandFloatCards>', () => {
  it('shows the real verified listing and the approved office count', () => {
    const facts: BrandPanelFacts = {
      highlight: {
        kind: 'listing',
        title: '해룡 중앙 아파트',
        area: '전용 84.97㎡(26평)',
        deal: 'sale',
        dealLabel: '매매',
        price: '4억 1,000',
        verifiedDate: '26.11.20',
        brokerCount: 2,
      },
      agencyCount: 41,
    };
    const { container } = render(<BrandFloatCards facts={facts} />);
    const card = screen.getByTestId('brand-listing-card');
    expect(card).toHaveTextContent('최근 실매물 확인');
    expect(card).toHaveTextContent('해룡 중앙 아파트');
    expect(card).toHaveTextContent('4억 1,000');
    expect(card).toHaveTextContent('실매물 확인 26.11.20');
    expect(card).toHaveTextContent('중개사 2곳');
    expect(screen.getByTestId('brand-agency-card')).toHaveTextContent('순천 중개사무소 41곳');
    expect(container.textContent).not.toMatch(SAMPLE_WORDS);
  });

  it('labels a 실거래 fallback with its source and 계약월', () => {
    render(
      <BrandFloatCards
        facts={{
          highlight: {
            kind: 'trade',
            title: '연향 아파트',
            emdName: '연향동',
            monthLabel: '2026년 10월',
            tradeCount: 7,
            medianPrice: '3억 500',
          },
          agencyCount: null,
        }}
      />,
    );
    const card = screen.getByTestId('brand-trade-card');
    expect(card).toHaveTextContent('국토교통부 실거래가 · 2026년 10월 계약');
    expect(card).toHaveTextContent('중위 거래가 · 거래 7건');
    expect(screen.queryByTestId('brand-agency-card')).not.toBeInTheDocument();
  });

  it('renders nothing without data', () => {
    const { container } = render(
      <BrandFloatCards facts={{ highlight: null, agencyCount: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
