import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { TotpReauthForm } from './TotpReauthForm';

const api = vi.hoisted(() => ({ startTotpSetup: vi.fn() }));
vi.mock('../../api', () => api);

const setup = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUrl: 'otpauth://totp/BRAND:me%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=BRAND',
  expiresInSeconds: 600,
};

beforeEach(() => api.startTotpSetup.mockReset());

describe('<TotpReauthForm> (authenticator re-enrolment, step 1)', () => {
  it('asks for the current password and code before calling POST /totp/setup once', async () => {
    api.startTotpSetup.mockResolvedValue(setup);
    const onSetup = vi.fn();
    render(<TotpReauthForm onSetup={onSetup} />);
    await userEvent.click(screen.getByRole('button', { name: '본인 확인' }));
    expect(await screen.findByText('현재 비밀번호를 입력해 주세요.')).toBeInTheDocument();
    expect(api.startTotpSetup).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/현재 비밀번호/), 'mock-admin-2026');
    // six digits typed: no auto-submit here, the password belongs to the same request
    await userEvent.type(screen.getByLabelText(/인증 앱의 코드/), '123456');
    expect(api.startTotpSetup).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '본인 확인' }));
    await waitFor(() => expect(onSetup).toHaveBeenCalledWith(setup));
    expect(api.startTotpSetup).toHaveBeenCalledTimes(1);
    expect(api.startTotpSetup).toHaveBeenCalledWith({
      currentPassword: 'mock-admin-2026',
      factor: { kind: 'code', value: '123456' },
    });
  });

  it('re-authenticates with a recovery code and maps the API refusals to the fields', async () => {
    api.startTotpSetup
      .mockRejectedValueOnce(new ApiError(401, { code: 'AUTH_INVALID_CREDENTIALS', message: 'x' }))
      .mockRejectedValueOnce(new ApiError(401, { code: 'AUTH_TOTP_INVALID', message: 'x' }));
    render(<TotpReauthForm onSetup={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/현재 비밀번호/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /복구 코드로 확인/ }));
    await userEvent.type(screen.getByLabelText('복구 코드'), 'h4tn8wxp');
    await userEvent.click(screen.getByRole('button', { name: '본인 확인' }));
    expect(await screen.findByText('현재 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(api.startTotpSetup).toHaveBeenLastCalledWith({
      currentPassword: 'wrong',
      factor: { kind: 'recovery', value: 'H4TN-8WXP' },
    });
    await userEvent.click(screen.getByRole('button', { name: '본인 확인' }));
    expect(
      await screen.findByText('복구 코드가 올바르지 않거나 이미 사용한 코드입니다.'),
    ).toBeInTheDocument();
  });
});
