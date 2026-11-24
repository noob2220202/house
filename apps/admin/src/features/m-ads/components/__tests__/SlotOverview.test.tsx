import { BannerSlot } from '@house/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlotOverview } from '../SlotOverview';
import { makeSlot } from './fixtures';

const slots = [
  makeSlot(BannerSlot.MAIN_HERO, { activeCount: 2 }),
  makeSlot(BannerSlot.MAP_AD, { activeCount: 3 }),
  makeSlot(BannerSlot.COMPLEX_FEATURED_AGENCY, { activeCount: 3, scheduledCount: 1 }),
];
const hrefFor = (slot: BannerSlot | null) => (slot ? `/banners?slot=${slot}` : '/banners');

describe('SlotOverview', () => {
  it('renders one card per slot with live / limit and a caption', () => {
    render(
      <SlotOverview
        slots={slots}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        selected={null}
        hrefFor={hrefFor}
      />,
    );
    const hero = screen.getByRole('link', { name: /^메인 상단 대형, 노출 중 2개, 최대 8개/ });
    expect(hero).toHaveAttribute('href', '/banners?slot=MAIN_HERO');
    expect(screen.getByRole('link', { name: /지도 광고.*1자리 남음/ })).toBeInTheDocument();
    expect(screen.getByText('가득 참 · 대기 1')).toBeInTheDocument();
  });

  it('the selected card clears the filter', () => {
    render(
      <SlotOverview
        slots={slots}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        selected={BannerSlot.MAP_AD}
        hrefFor={hrefFor}
      />,
    );
    const card = screen.getByRole('link', { name: /지도 광고.*필터 해제/ });
    expect(card).toHaveAttribute('href', '/banners');
    expect(card).toHaveAttribute('aria-current', 'true');
  });

  it('shows a dash when the counts are unknown', () => {
    render(
      <SlotOverview
        slots={[makeSlot(BannerSlot.MAIN_HERO, { activeCount: null })]}
        loading={false}
        error={false}
        onRetry={vi.fn()}
        selected={null}
        hrefFor={hrefFor}
      />,
    );
    expect(screen.getByRole('link', { name: /노출 중 –개/ })).toBeInTheDocument();
  });

  it('has loading and error states', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <SlotOverview
        slots={undefined}
        loading
        error={false}
        onRetry={onRetry}
        selected={null}
        hrefFor={hrefFor}
      />,
    );
    expect(screen.getByLabelText('노출 위치별 현황')).toHaveAttribute('aria-busy', 'true');
    rerender(
      <SlotOverview
        slots={undefined}
        loading={false}
        error
        onRetry={onRetry}
        selected={null}
        hrefFor={hrefFor}
      />,
    );
    expect(screen.getByText('노출 위치 현황을 불러오지 못했어요')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /다시/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
