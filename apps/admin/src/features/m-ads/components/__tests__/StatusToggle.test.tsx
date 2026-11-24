import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusToggle } from '../StatusToggle';
import { inDays } from './fixtures';

const live = { paused: false, startAt: inDays(-10), endAt: inDays(7.5) };

describe('StatusToggle', () => {
  it('shows the computed status and what comes next', () => {
    render(<StatusToggle item={live} name="AD-01 견본주택 오픈" onToggle={vi.fn()} />);
    const sw = screen.getByRole('switch', { name: /AD-01 견본주택 오픈 노출 켜기 \(현재 노출\)/ });
    expect(sw).toBeChecked();
    expect(screen.getByText(/일 남음$/)).toBeInTheDocument();
  });

  it('pauses a live item and resumes a paused one', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<StatusToggle item={live} name="AD-01" onToggle={onToggle} />);
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenLastCalledWith(true);

    rerender(
      <StatusToggle
        item={{ ...live, paused: true, memo: '광고주 요청' }}
        name="AD-01"
        onToggle={onToggle}
      />,
    );
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByText('중지')).toBeInTheDocument();
    expect(screen.getByText('광고주 요청')).toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('a scheduled item is "on" and labelled 예약', () => {
    render(
      <StatusToggle
        item={{ paused: false, startAt: inDays(7), endAt: inDays(37) }}
        name="AD-03"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('switch', { name: /현재 예약/ })).toBeChecked();
    expect(screen.getByText(/시작$/)).toBeInTheDocument();
  });

  it('an ended item cannot be switched on', () => {
    render(
      <StatusToggle
        item={{ paused: false, startAt: inDays(-40), endAt: inDays(-5) }}
        name="AD-06"
        onToggle={vi.fn()}
      />,
    );
    const sw = screen.getByRole('switch', { name: /현재 종료/ });
    expect(sw).toBeDisabled();
    expect(sw).not.toBeChecked();
  });
});
