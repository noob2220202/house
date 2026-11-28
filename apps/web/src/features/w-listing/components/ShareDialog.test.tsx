import { ToastProvider } from '@house/ui';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ListingDetail } from '../api/schemas';
import { ShareDialog } from './ShareDialog';

vi.mock('../lib/view', () => ({
  listingFullTitle: () => '신대 레이크파크 1단지 103동 매매 4억 4,500',
}));

const listing = { id: '11111111-0000-4000-8000-000000000001' } as ListingDetail;

const renderDialog = () =>
  render(
    <ToastProvider>
      <ShareDialog listing={listing} open onClose={() => {}} />
    </ToastProvider>,
  );

describe('ShareDialog', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
  });

  it('offers the link to copy and no "카카오톡으로 보내기" placeholder button', () => {
    renderDialog();
    expect(screen.getByLabelText('매물 주소')).toHaveValue(
      `${window.location.origin}/listing/${listing.id}`,
    );
    expect(screen.getByRole('button', { name: '복사' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /카카오톡/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '다른 앱으로 공유' })).toBeNull();
  });

  it('adds the native share sheet when the browser has one', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
    renderDialog();
    expect(await screen.findByRole('button', { name: '다른 앱으로 공유' })).toBeInTheDocument();
  });
});
