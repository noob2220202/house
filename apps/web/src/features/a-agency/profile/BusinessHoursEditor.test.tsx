import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUSINESS_HOURS } from '../lib/business-hours';
import { BusinessHoursEditor, type HoursDraft } from './BusinessHoursEditor';

const hours = (): HoursDraft => ({ ...DEFAULT_BUSINESS_HOURS });

describe('BusinessHoursEditor', () => {
  it('renders a labelled switch and two selects per open day', () => {
    render(<BusinessHoursEditor value={hours()} onChange={() => undefined} />);
    expect(screen.getAllByRole('switch')).toHaveLength(7);
    expect(screen.getByRole('switch', { name: '월요일 영업' })).toBeChecked();
    expect(screen.getByRole('switch', { name: '일요일 영업' })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: '토요일 여는 시간' })).toHaveValue('10:00');
    expect(screen.queryByRole('combobox', { name: '일요일 여는 시간' })).not.toBeInTheDocument();
  });

  it('opens a closed day with default hours and closes an open one', async () => {
    const onChange = vi.fn();
    render(<BusinessHoursEditor value={hours()} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: '일요일 영업' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sun: { open: '09:00', close: '18:00' } }),
    );
    await userEvent.click(screen.getByRole('switch', { name: '토요일 영업' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sat: null }));
  });

  it('flags a day that closes before it opens', () => {
    render(
      <BusinessHoursEditor
        value={{ ...hours(), mon: { open: '18:00', close: '09:00' } }}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('닫는 시간은 여는 시간보다 늦어야 해요.');
  });

  it('copies Monday to all weekdays', async () => {
    const onChange = vi.fn();
    const value = { ...hours(), mon: { open: '10:00', close: '20:00' } };
    render(<BusinessHoursEditor value={value} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '월요일 시간을 평일 전체에 적용' }));
    const next = onChange.mock.calls[0]?.[0] as HoursDraft;
    expect(next.fri).toEqual({ open: '10:00', close: '20:00' });
    expect(next.sat).toEqual({ open: '10:00', close: '15:00' });
  });
});
