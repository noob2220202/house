import { TermsType } from '@house/shared';
import { ToastProvider } from '@house/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coarsenPosition } from '@/lib/map';
import { resetGuestLocationConsent, useMyLocation, type DevicePosition } from './useMyLocation';

const session = vi.hoisted(() => ({ status: 'unauthenticated' as string }));
vi.mock('@/lib/auth', () => ({ useSession: () => session }));

const calls = vi.hoisted(() => ({
  fetchConsents: vi.fn(),
  fetchTermsDocument: vi.fn(),
  submitConsents: vi.fn(),
}));
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  fetchConsents: calls.fetchConsents,
  fetchTermsDocument: calls.fetchTermsDocument,
  submitConsents: calls.submitConsents,
}));

const DEVICE = { lat: 34.950_123, lng: 127.487_654 };
const LOCATION_DOC = {
  id: 'terms-location-2',
  type: TermsType.LOCATION,
  version: '2.0',
  title: '위치기반서비스 이용약관',
  isRequired: false,
  effectiveAt: '2026-11-01T00:00:00+09:00',
  content: '현재 위치는 기기 안에서만 사용합니다.',
};
const consentRow = (agreed: boolean) => ({
  termsDocumentId: LOCATION_DOC.id,
  type: TermsType.LOCATION,
  version: LOCATION_DOC.version,
  title: LOCATION_DOC.title,
  isRequired: false,
  effectiveAt: LOCATION_DOC.effectiveAt,
  agreed,
  decidedAt: agreed ? '2026-11-20T00:00:00Z' : null,
});

const getCurrentPosition = vi.fn((ok: PositionCallback) =>
  ok({ coords: { latitude: DEVICE.lat, longitude: DEVICE.lng } } as GeolocationPosition),
);

function Probe({ onLocated }: { onLocated: (p: DevicePosition) => void }) {
  const { locate, dialog } = useMyLocation();
  return (
    <>
      <button type="button" onClick={() => locate(onLocated)}>
        내 위치
      </button>
      {dialog}
    </>
  );
}

function renderProbe() {
  const onLocated = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Probe onLocated={onLocated} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onLocated, user: userEvent.setup() };
}


describe('useMyLocation (위치기반서비스 consent before the device position)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGuestLocationConsent();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    calls.fetchTermsDocument.mockResolvedValue(LOCATION_DOC);
  });
  afterEach(() => {
    session.status = 'unauthenticated';
  });

  it('coarsens the device position to a ~500 m cell', () => {
    const cell = coarsenPosition(DEVICE);
    expect(cell).toEqual({ lat: 34.9525, lng: 127.4875 });
    // Every point of the cell maps to the same centre: the map never reveals more than the cell.
    expect(coarsenPosition({ lat: 34.9501, lng: 127.4851 })).toEqual(cell);
    expect(coarsenPosition({ lat: 34.9549, lng: 127.4899 })).toEqual(cell);
  });

  it('member without the LOCATION consent: shows the document, records the agreement, then locates', async () => {
    session.status = 'authenticated';
    calls.fetchConsents.mockResolvedValue([consentRow(false)]);
    calls.submitConsents.mockResolvedValue([consentRow(true)]);
    const { onLocated, user } = renderProbe();

    await user.click(screen.getByRole('button', { name: '내 위치' }));
    expect(await screen.findByRole('document', { name: '약관 전문' })).toHaveTextContent(
      LOCATION_DOC.content,
    );
    expect(getCurrentPosition).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '동의하고 내 위치 보기' }));
    await waitFor(() => expect(onLocated).toHaveBeenCalledTimes(1));
    expect(calls.submitConsents).toHaveBeenCalledWith({
      consents: [{ termsDocumentId: LOCATION_DOC.id, agreed: true }],
    });
    expect(onLocated).toHaveBeenCalledWith({ coarse: coarsenPosition(DEVICE), precise: DEVICE });

    // Recorded: the next tap locates at once.
    await user.click(screen.getByRole('button', { name: '내 위치' }));
    await waitFor(() => expect(onLocated).toHaveBeenCalledTimes(2));
    expect(calls.submitConsents).toHaveBeenCalledTimes(1);
  });

  it('member who already agreed: locates without asking', async () => {
    session.status = 'authenticated';
    calls.fetchConsents.mockResolvedValue([consentRow(true)]);
    const { onLocated, user } = renderProbe();
    await user.click(screen.getByRole('button', { name: '내 위치' }));
    await waitFor(() => expect(onLocated).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('declining (취소) never reads the device position', async () => {
    session.status = 'authenticated';
    calls.fetchConsents.mockResolvedValue([consentRow(false)]);
    const { onLocated, user } = renderProbe();
    await user.click(screen.getByRole('button', { name: '내 위치' }));
    await screen.findByRole('document', { name: '약관 전문' });
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(onLocated).not.toHaveBeenCalled();
    expect(calls.submitConsents).not.toHaveBeenCalled();
  });

  it('visitor: asks once per page session, records nothing and gets the coarse cell only', async () => {
    const { onLocated, user } = renderProbe();
    await user.click(screen.getByRole('button', { name: '내 위치' }));
    expect(await screen.findByText(/동의 기록을 남기지 않아요/)).toBeInTheDocument();
    await screen.findByRole('document', { name: '약관 전문' });
    await user.click(screen.getByRole('button', { name: '동의하고 내 위치 보기' }));
    await waitFor(() => expect(onLocated).toHaveBeenCalledTimes(1));
    expect(onLocated).toHaveBeenCalledWith({ coarse: coarsenPosition(DEVICE), precise: null });
    expect(calls.submitConsents).not.toHaveBeenCalled();
    expect(calls.fetchConsents).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '내 위치' }));
    await waitFor(() => expect(onLocated).toHaveBeenCalledTimes(2));
  });

  it('no published LOCATION document: the feature stays off', async () => {
    const { ApiError } = await import('@/lib/api');
    calls.fetchTermsDocument.mockRejectedValue(
      new ApiError(404, { code: 'TERMS_NOT_FOUND', message: 'not found' }),
    );
    const { user } = renderProbe();
    await user.click(screen.getByRole('button', { name: '내 위치' }));
    expect(await screen.findByText(/아직 게시되지 않아/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '동의하고 내 위치 보기' })).toBeDisabled();
  });
});
