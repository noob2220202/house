import { BannerSlot, BannerStatus, BannerTargeting } from '@house/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BannerTable, type BannerTableProps } from '../BannerTable';
import { ID, inDays, makeBanner, makeSlot } from './fixtures';

const rows = [
  makeBanner(1, { title: '연향들 더 퍼스트 견본주택 오픈' }),
  makeBanner(2, {
    title: '순천 이사·입주청소 한 번에 예약',
    advertiserName: '늘봄 이사·청소',
    startAt: inDays(7),
    endAt: inDays(37),
    status: BannerStatus.SCHEDULED,
    impressions: 0,
    clicks: 0,
    targeting: BannerTargeting.REGIONS,
    targetRegions: [
      { code: '1', name: '신대지구' },
      { code: '2', name: '선월지구' },
      { code: '3', name: '연향동' },
    ],
  }),
  makeBanner(3, {
    slot: BannerSlot.MAIN_STRIP,
    sortOrder: 1,
    title: '관심 단지 새 매물 알림 받기',
    advertiserName: '운영사 캠페인',
    impressions: 31402,
    clicks: 408,
  }),
];

function setup(props: Partial<BannerTableProps> = {}) {
  const handlers = {
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onToggle: vi.fn(),
    onReorder: vi.fn(),
  };
  render(
    <BannerTable
      rows={rows}
      slots={[makeSlot(BannerSlot.MAIN_HERO), makeSlot(BannerSlot.MAIN_STRIP)]}
      editingId={null}
      statsHref={(id) => `/banners/${id}/stats`}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, user: userEvent.setup() };
}
const row = (title: string) => screen.getByText(title).closest('tr') as HTMLElement;

describe('BannerTable', () => {
  it('renders slot + order, advertiser, target and stats per row', () => {
    setup();
    const first = within(row('연향들 더 퍼스트 견본주택 오픈'));
    expect(first.getByText('메인 상단 대형 1')).toBeInTheDocument();
    expect(first.getByText('분양 광고주 A')).toBeInTheDocument();
    expect(first.getByText('전체')).toBeInTheDocument();
    expect(first.getByText('48,210')).toBeInTheDocument();
    expect(first.getByText('1,126 · 2.3%')).toBeInTheDocument();
    expect(
      first.getByRole('link', { name: /통계 보기, 노출 48,210회, 클릭 1,126회/ }),
    ).toHaveAttribute('href', `/banners/${ID(1)}/stats`);

    const second = within(row('순천 이사·입주청소 한 번에 예약'));
    expect(second.getByText('신대·선월·연향')).toBeInTheDocument();
    expect(second.getByText('게시 전')).toBeInTheDocument();
    expect(second.getByRole('switch', { name: /현재 예약/ })).toBeChecked();
  });

  it('marks the row that is open in the editor', () => {
    setup({ editingId: ID(2) });
    const editing = within(row('순천 이사·입주청소 한 번에 예약'));
    expect(editing.getByText('수정 중')).toBeInTheDocument();
    expect(editing.getByRole('button', { name: /수정$/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('wires the row actions', async () => {
    const { user, onEdit, onDuplicate, onDelete, onToggle } = setup();
    const first = within(row('연향들 더 퍼스트 견본주택 오픈'));
    await user.click(
      first.getByRole('button', { name: 'AD-01 연향들 더 퍼스트 견본주택 오픈 수정' }),
    );
    await user.click(first.getByRole('button', { name: /복제$/ }));
    await user.click(first.getByRole('button', { name: /삭제$/ }));
    await user.click(first.getByRole('switch'));
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
    expect(onDuplicate).toHaveBeenCalledWith(rows[0]);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
    expect(onToggle).toHaveBeenCalledWith(rows[0], true);
  });

  it('moves a row inside its slot with the arrow keys', () => {
    const { onReorder } = setup();
    const handle = within(row('연향들 더 퍼스트 견본주택 오픈')).getByRole('button', {
      name: /순서 이동/,
    });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith({
      slot: BannerSlot.MAIN_HERO,
      group: BannerSlot.MAIN_HERO,
      ids: [ID(2), ID(1)],
      movedId: ID(1),
      index: 1,
    });
  });

  it('never moves a row across slots', () => {
    const { onReorder } = setup();
    // last row of 메인 상단 대형 → the next row belongs to another slot
    fireEvent.keyDown(
      within(row('순천 이사·입주청소 한 번에 예약')).getByRole('button', { name: /순서 이동/ }),
      { key: 'ArrowDown' },
    );
    // first row of the list
    fireEvent.keyDown(
      within(row('연향들 더 퍼스트 견본주택 오픈')).getByRole('button', { name: /순서 이동/ }),
      { key: 'ArrowUp' },
    );
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('disables the handle when the slot has a single visible row', () => {
    setup();
    expect(
      within(row('관심 단지 새 매물 알림 받기')).getByRole('button', { name: /순서 이동/ }),
    ).toBeDisabled();
  });
});
