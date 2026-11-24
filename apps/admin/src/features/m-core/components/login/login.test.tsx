import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { CredentialsForm } from './CredentialsForm';
import { OtpInput } from './OtpInput';
import { QrCode } from './QrCode';
import { TotpEnroll } from './TotpEnroll';
import { TotpCodeForm } from './TotpStep';

const api = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  verifyTotp: vi.fn(),
  startTotpSetup: vi.fn(),
}));
vi.mock('../../api', () => api);

beforeEach(() => {
  api.loginWithPassword.mockReset();
  api.verifyTotp.mockReset();
  api.startTotpSetup.mockReset();
});

function Otp({ onComplete, error }: { onComplete?: (v: string) => void; error?: string }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} error={error} />;
}

describe('<OtpInput>', () => {
  it('is one labelled one-time-code field that keeps digits only', async () => {
    const onComplete = vi.fn();
    render(<Otp onComplete={onComplete} />);
    const input = screen.getByLabelText(/인증 코드/);
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    await userEvent.type(input, '12a3 4');
    expect(input).toHaveValue('1234');
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.type(input, '56');
    expect(input).toHaveValue('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('accepts a pasted code with spaces', async () => {
    const onComplete = vi.fn();
    render(<Otp onComplete={onComplete} />);
    const input = screen.getByLabelText(/인증 코드/);
    input.focus();
    await userEvent.paste('123 456');
    expect(input).toHaveValue('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('announces an error', () => {
    render(<Otp error="인증 코드가 올바르지 않습니다." />);
    const input = screen.getByLabelText(/인증 코드/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('인증 코드가 올바르지 않습니다.');
    expect(input).toHaveAccessibleDescription('인증 코드가 올바르지 않습니다.');
  });
});

describe('<QrCode>', () => {
  const uri = 'otpauth://totp/BRAND:new%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=BRAND';

  it('renders the URI locally as an SVG without exposing the secret', () => {
    const { container } = render(<QrCode value={uri} label="인증 앱 등록용 QR 코드" />);
    const svg = screen.getByRole('img', { name: '인증 앱 등록용 QR 코드' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    // 76 bytes → version 5 at level M (37 modules) + 2 quiet modules on each side
    expect(svg).toHaveAttribute('viewBox', '0 0 41 41');
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
    expect(container.innerHTML).not.toContain('JBSWY3DPEHPK3PXP');
    expect(container.querySelector('img')).toBeNull(); // no external QR image service
  });

  it('renders nothing when the text cannot be encoded', () => {
    const { container } = render(<QrCode value={'x'.repeat(4000)} label="QR" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('<CredentialsForm>', () => {
  it('validates before calling the API', async () => {
    render(<CredentialsForm onSuccess={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('이메일을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('이메일'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('이메일 형식이 올바르지 않습니다.')).toBeInTheDocument();
    expect(api.loginWithPassword).not.toHaveBeenCalled();
  });

  it('hands the result to the flow on success', async () => {
    api.loginWithPassword.mockResolvedValue({ mfaVerified: false, totpEnrolled: true });
    const onSuccess = vi.fn();
    render(<CredentialsForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText('이메일'), ' admin@example.com ');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'correct horse 1');
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(api.loginWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'correct horse 1',
    });
    expect(onSuccess).toHaveBeenCalledWith(
      { mfaVerified: false, totpEnrolled: true },
      'admin@example.com',
    );
  });

  it('shows a form-level alert for wrong credentials and a locked account', async () => {
    api.loginWithPassword.mockRejectedValueOnce(
      new ApiError(401, { code: 'AUTH_INVALID_CREDENTIALS', message: 'x' }),
    );
    render(<CredentialsForm onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('이메일'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
    expect(screen.getByLabelText('비밀번호')).toHaveFocus();

    api.loginWithPassword.mockRejectedValueOnce(
      new ApiError(423, { code: 'AUTH_ACCOUNT_LOCKED', message: 'x' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('계정이 잠겼습니다'));
  });

  it('maps backend validation details to the fields', async () => {
    api.loginWithPassword.mockRejectedValue(
      new ApiError(400, {
        code: 'VALIDATION_FAILED',
        message: '입력 내용을 확인해 주세요.',
        details: [{ path: 'email', message: '등록되지 않은 도메인입니다.' }],
      }),
    );
    render(<CredentialsForm onSuccess={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('이메일'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('등록되지 않은 도메인입니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
  });

  it('toggles password visibility', async () => {
    render(<CredentialsForm onSuccess={vi.fn()} />);
    const password = screen.getByLabelText('비밀번호');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 표시' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '비밀번호 숨기기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('<TotpCodeForm>', () => {
  it('submits by itself once six digits are in', async () => {
    api.verifyTotp.mockResolvedValue({ ok: true });
    const onVerified = vi.fn();
    render(<TotpCodeForm onVerified={onVerified} />);
    await userEvent.type(screen.getByLabelText(/인증 코드/), '123456');
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith({ ok: true }));
    expect(api.verifyTotp).toHaveBeenCalledTimes(1);
    expect(api.verifyTotp).toHaveBeenCalledWith('123456');
  });

  it('asks for all six digits', async () => {
    render(<TotpCodeForm onVerified={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/인증 코드/), '123');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('인증 코드 6자리를 입력해 주세요.');
    expect(api.verifyTotp).not.toHaveBeenCalled();
  });

  it('clears a wrong code so the next one can be typed', async () => {
    api.verifyTotp.mockRejectedValue(
      new ApiError(400, { code: 'AUTH_TOTP_INVALID', message: 'x' }),
    );
    const onSessionLost = vi.fn();
    render(<TotpCodeForm onVerified={vi.fn()} onSessionLost={onSessionLost} />);
    const input = screen.getByLabelText(/인증 코드/);
    await userEvent.type(input, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('인증 코드가 올바르지 않습니다');
    await waitFor(() => expect(input).toHaveValue(''));
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('restarts the login when the half-authenticated session expired', async () => {
    api.verifyTotp.mockRejectedValue(new ApiError(401, { code: 'UNAUTHENTICATED', message: 'x' }));
    const onSessionLost = vi.fn();
    render(<TotpCodeForm onVerified={vi.fn()} onSessionLost={onSessionLost} />);
    await userEvent.type(screen.getByLabelText(/인증 코드/), '123456');
    await waitFor(() => expect(onSessionLost).toHaveBeenCalledTimes(1));
    expect(onSessionLost.mock.calls[0]![0]).toContain('처음부터 다시');
  });
});

describe('<TotpEnroll>', () => {
  const setup = (secret: string) => ({
    secret,
    otpauthUrl: `otpauth://totp/BRAND:me%40example.com?secret=${secret}&issuer=BRAND`,
  });

  it('shows the secret of the latest setup call only (each call replaces the secret server-side)', async () => {
    // StrictMode runs the mount effect twice; the first, slower response must not win.
    let releaseFirst: (v: ReturnType<typeof setup>) => void = () => undefined;
    api.startTotpSetup
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce(setup('BBBBCCCCDDDDEEEE'));
    render(
      <StrictMode>
        <TotpEnroll onVerified={vi.fn()} />
      </StrictMode>,
    );
    expect(await screen.findByText('BBBB CCCC DDDD EEEE')).toBeInTheDocument();
    releaseFirst(setup('AAAAAAAAAAAAAAAA'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('AAAA AAAA AAAA AAAA')).not.toBeInTheDocument();
    expect(screen.getByText('BBBB CCCC DDDD EEEE')).toBeInTheDocument();
  });

  it('offers the otpauth:// hand-off for an authenticator on the same phone', async () => {
    api.startTotpSetup.mockResolvedValue(setup('JBSWY3DPEHPK3PXP'));
    render(<TotpEnroll onVerified={vi.fn()} />);
    const link = await screen.findByRole('link', { name: /인증 앱에 추가/ });
    expect(link.getAttribute('href')).toMatch(/^otpauth:\/\/totp\//);
  });
});
