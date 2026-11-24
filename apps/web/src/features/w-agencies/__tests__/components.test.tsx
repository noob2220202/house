import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AgencySummary } from '../api/schemas';
import { DealCountBar } from '../components/DealCountBar';
import { OfficeCard } from '../components/OfficeCard';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const agency: AgencySummary = {
  id: 'b02',
  name: '호수공원 공인중개사사무소',
  representativeName: '한서윤',
  registrationNumber: '46150-2014-00038',
  phone: '0610000000',
  roadAddress: '전라남도 순천시 조례동 호수공원길 24',
  addressDetail: '1층',
  emdName: '조례동',
  lat: 34.96,
  lng: 127.54,
  specialties: ['APT'],
  activeListingCount: 46,
  topComplexes: [
    { id: 'c4', name: '조례 호수마을' },
    { id: 'c2', name: '연향 센트럴' },
    { id: 'c7', name: '금당 리버뷰' },
  ],
};

describe('OfficeCard', () => {
  it('shows the fields of the design card', () => {
    render(<OfficeCard agency={agency} />);
    const link = screen.getByRole('link', { name: '호수공원 공인중개사사무소' });
    expect(link).toHaveAttribute('href', '/agency/b02');
    expect(screen.getByText('한서윤')).toBeInTheDocument();
    expect(screen.getByText('46')).toBeInTheDocument();
    expect(screen.getByText('조례동 호수공원길 24, 1층')).toBeInTheDocument();
    expect(screen.getByText('46150-2014-00038')).toBeInTheDocument();
    // At most two complexes.
    const tags = screen.getByRole('list', { name: '전문 단지' });
    expect(tags.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '호수공원 공인중개사사무소에 전화' })).toHaveAttribute(
      'href',
      'tel:0610000000',
    );
  });

  it('falls back to specialties when no complexes are known', () => {
    render(
      <OfficeCard agency={{ ...agency, topComplexes: [], specialties: ['ONEROOM', 'LAND'] }} />,
    );
    const tags = screen.getByRole('list', { name: '전문 분야' });
    expect(tags).toHaveTextContent('원룸·투룸');
    expect(tags).toHaveTextContent('토지');
  });

  it('opens the profile on a plain click and marks the selected card', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<OfficeCard agency={agency} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('link', { name: '호수공원 공인중개사사무소' }));
    expect(onSelect).toHaveBeenCalledWith(agency);

    rerender(<OfficeCard agency={agency} onSelect={onSelect} selected />);
    expect(screen.getByRole('link', { name: '호수공원 공인중개사사무소' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('lets modified clicks through to the real link (new tab)', async () => {
    const onSelect = vi.fn();
    render(<OfficeCard agency={agency} onSelect={onSelect} />);
    const link = screen.getByRole('link', { name: '호수공원 공인중개사사무소' });
    link.addEventListener('click', (e) => e.preventDefault()); // jsdom: no navigation
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides the call button without a dialable number', () => {
    render(<OfficeCard agency={{ ...agency, phone: '' }} />);
    expect(screen.queryByRole('link', { name: /전화/ })).not.toBeInTheDocument();
  });
});

describe('DealCountBar', () => {
  it('announces all four counts and dims zeros', () => {
    render(<DealCountBar counts={{ presale: 0, sale: 24, jeonse: 13, monthly: 9 }} />);
    expect(
      screen.getByRole('img', { name: '분양 0건, 매매 24건, 전세 13건, 월세 9건' }),
    ).toBeInTheDocument();
  });
});
