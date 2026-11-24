import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReasonDialog, type ReasonDialogProps } from './ReasonDialog';

function setup(props: Partial<ReasonDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ReasonDialog
      open
      onClose={onClose}
      onConfirm={onConfirm}
      title="신청 반려"
      reasonLabel="반려 사유"
      confirmLabel="반려"
      presets={['서류가 흐려 내용을 확인할 수 없습니다.']}
      {...props}
    />,
  );
  const dialog = screen.getByRole('dialog');
  return { onConfirm, onClose, dialog, user: userEvent.setup() };
}

describe('ReasonDialog', () => {
  it('requires a reason before confirming', async () => {
    const { onConfirm, dialog, user } = setup();
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('5자 이상 입력해 주세요.');
    expect(within(dialog).getByLabelText(/반려 사유/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a reason shorter than the minimum', async () => {
    const { onConfirm, dialog, user } = setup({ minLength: 5 });
    await user.type(within(dialog).getByLabelText(/반려 사유/), '  짧음  ');
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the trimmed reason', async () => {
    const { onConfirm, dialog, user } = setup();
    await user.type(
      within(dialog).getByLabelText(/반려 사유/),
      '  등록번호가 조회되지 않습니다.  ',
    );
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('등록번호가 조회되지 않습니다.');
  });

  it('fills the reason from a preset', async () => {
    const { onConfirm, dialog, user } = setup();
    await user.click(
      within(dialog).getByRole('button', { name: '서류가 흐려 내용을 확인할 수 없습니다.' }),
    );
    expect(within(dialog).getByLabelText(/반려 사유/)).toHaveValue(
      '서류가 흐려 내용을 확인할 수 없습니다.',
    );
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    expect(onConfirm).toHaveBeenCalledWith('서류가 흐려 내용을 확인할 수 없습니다.');
  });

  it('allows an empty reason when it is optional', async () => {
    const { onConfirm, dialog, user } = setup({ required: false, confirmLabel: '숨김 해제' });
    await user.click(within(dialog).getByRole('button', { name: '숨김 해제' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('blocks the confirm button while extra choices are incomplete', async () => {
    const { onConfirm, dialog, user } = setup({ confirmDisabled: true });
    await user.type(within(dialog).getByLabelText(/반려 사유/), '충분히 긴 사유입니다.');
    const confirm = within(dialog).getByRole('button', { name: '반려' });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a server error inside the dialog', () => {
    const { dialog } = setup({ error: '이미 처리된 신청입니다.' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('이미 처리된 신청입니다.');
  });
});
