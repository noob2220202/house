import { BannerSlot } from '@house/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LivePreview } from '../LivePreview';
import { makeSlot } from './fixtures';

describe('LivePreview', () => {
  it('shows the title in a placeholder until an image is uploaded', () => {
    render(
      <LivePreview
        slot={BannerSlot.MAIN_HERO}
        info={makeSlot(BannerSlot.MAIN_HERO)}
        title="순천 이사·입주청소"
        pcUrl={null}
        mobileUrl={null}
        position={2}
      />,
    );
    expect(screen.getAllByText('순천 이사·입주청소')).toHaveLength(2); // desktop + phone
    expect(screen.getByText(/PC · 메인 상단 대형 2번째/)).toBeInTheDocument();
    expect(screen.queryByText('PC 이미지로 대체 중')).not.toBeInTheDocument();
  });

  it('warns when the phone falls back to the PC image', () => {
    const { container, rerender } = render(
      <LivePreview
        slot={BannerSlot.MAIN_HERO}
        info={makeSlot(BannerSlot.MAIN_HERO)}
        title="t"
        pcUrl="/media/banner/pc.webp"
        mobileUrl={null}
        position={1}
      />,
    );
    expect(screen.getByText('PC 이미지로 대체 중')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(2);

    rerender(
      <LivePreview
        slot={BannerSlot.MAIN_HERO}
        info={makeSlot(BannerSlot.MAIN_HERO)}
        title="t"
        pcUrl="/media/banner/pc.webp"
        mobileUrl="/media/banner/m.webp"
        position={1}
      />,
    );
    expect(screen.queryByText('PC 이미지로 대체 중')).not.toBeInTheDocument();
  });

  it('says when a slot is not shown on phones', () => {
    render(
      <LivePreview
        slot={BannerSlot.LISTING_SIDE}
        info={makeSlot(BannerSlot.LISTING_SIDE)}
        title="t"
        pcUrl="/media/banner/pc.webp"
        mobileUrl={null}
        position={1}
      />,
    );
    expect(screen.getByText('모바일 미노출')).toBeInTheDocument();
    expect(screen.queryByText('PC 이미지로 대체 중')).not.toBeInTheDocument();
  });

  it('shows only the phone for the mobile-only slot', () => {
    render(
      <LivePreview
        slot={BannerSlot.MOBILE_MAIN}
        info={makeSlot(BannerSlot.MOBILE_MAIN)}
        title="t"
        pcUrl="/media/banner/m.webp"
        mobileUrl={null}
        position={3}
      />,
    );
    expect(screen.getByText('모바일 · 3번째')).toBeInTheDocument();
    expect(screen.queryByText(/^PC ·/)).not.toBeInTheDocument();
  });

  it('links to the page of the user site that carries the slot', () => {
    render(
      <LivePreview
        slot={BannerSlot.AGENCY_SEARCH_TOP}
        info={makeSlot(BannerSlot.AGENCY_SEARCH_TOP)}
        title="t"
        pcUrl={null}
        mobileUrl={null}
        position={1}
      />,
    );
    const link = screen.getByRole('link', { name: /실제 화면/ });
    expect(link.getAttribute('href')).toMatch(/\/agencies$/);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
