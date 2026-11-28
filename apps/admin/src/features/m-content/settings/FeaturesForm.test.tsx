import { SUBSCRIPTION_REQUIRED_FEATURE } from '@house/shared';
import { ToastProvider } from '@house/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { groupFlags } from '../lib/features';
import { FeaturesForm } from './FeaturesForm';

const setting = vi.hoisted(() => ({
  query: {
    data: {
      // Stable stored value (FeaturesForm memoises on its identity).
      value: {
        dealRequests: true,
        tradeHistory: true,
        community: false,
        appBand: false,
        siteSubscriptionRequired: false,
        platformSubscriptionRequired: false,
      },
      updatedAt: null,
      updatedByAdminName: null,
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: () => undefined,
  },
  save: { mutate: () => undefined, isPending: false },
}));
vi.mock('./use-site-setting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./use-site-setting')>();
  return { ...actual, useSiteSetting: () => setting };
});

describe('<FeaturesForm>', () => {
  it('keeps the 유료 적용 switches apart from the visibility flags and their n/m count', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <FeaturesForm />
      </ToastProvider>,
    );
    const features = screen.getByRole('heading', { name: /기능 설정/ }).closest('section')!;
    expect(within(features).getByText('2/4')).toBeInTheDocument();
    expect(within(features).queryByText(/유료 적용/)).not.toBeInTheDocument();

    const paid = screen.getByRole('heading', { name: '유료 적용' }).closest('section')!;
    expect(within(paid).getByText(/켜면 이용 기간이 있는 사무소만/)).toBeInTheDocument();
    // Turning a 유료 적용 switch on is not "one more feature enabled".
    await user.click(within(paid).getByRole('switch', { name: '사무소 홈페이지 유료 적용 사용' }));
    expect(within(features).getByText('2/4')).toBeInTheDocument();
    expect(screen.getByText('저장하지 않은 변경 사항이 있어요')).toBeInTheDocument();
  });

  it('puts unknown backend flags with the visibility flags', () => {
    expect(groupFlags(['dealRequests', SUBSCRIPTION_REQUIRED_FEATURE.SITE, 'newFlag'])).toEqual({
      visibility: ['dealRequests', 'newFlag'],
      paid: [SUBSCRIPTION_REQUIRED_FEATURE.SITE],
    });
  });
});
