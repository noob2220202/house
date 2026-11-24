import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentSlots } from './DocumentSlots';

describe('DocumentSlots', () => {
  it('shows a picker per slot and marks required ones', () => {
    render(<DocumentSlots pending={{}} onPick={() => undefined} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText('필수')).toBeInTheDocument();
    expect(within(items[2]!).getByText('권장')).toBeInTheDocument();
    expect(within(items[2]!).getByText('손해배상책임 보증서류')).toBeInTheDocument();
    expect(within(items[3]!).getByText('선택')).toBeInTheDocument();
    expect(screen.getByLabelText('중개사무소 등록증 파일 선택')).toHaveAttribute(
      'accept',
      'application/pdf,image/jpeg,image/png',
    );
  });

  it('passes the picked file with its slot type', async () => {
    const onPick = vi.fn();
    render(<DocumentSlots pending={{}} onPick={onPick} />);
    const file = new File(['%PDF'], '사업자등록증.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('사업자등록증 파일 선택'), file);
    expect(onPick).toHaveBeenCalledWith('BUSINESS_REG_CERT', file);
  });

  it('renders submitted, uploading and failed files', () => {
    render(
      <DocumentSlots
        existing={{
          REGISTRATION_CERT: {
            id: 'd1',
            type: 'REGISTRATION_CERT',
            mediaId: 'm1',
            fileName: '등록증.pdf',
            createdAt: '2026-11-22T03:00:00Z',
          },
        }}
        pending={{
          BUSINESS_REG_CERT: {
            type: 'BUSINESS_REG_CERT',
            fileName: 'biz.jpg',
            status: 'uploading',
          },
          OTHER: {
            type: 'OTHER',
            fileName: 'big.pdf',
            status: 'error',
            error: '파일이 너무 커요. 10MB 이하로 올려 주세요.',
          },
        }}
        onPick={() => undefined}
        onRemove={() => undefined}
      />,
    );
    expect(screen.getByText('등록증.pdf')).toBeInTheDocument();
    expect(screen.getByText(/제출 완료 · 26\.11\.22/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /보기/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/media/m1/private'),
    );
    expect(screen.getByText('업로드 중…')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('파일이 너무 커요');
  });

  it('flags missing required documents and hides pickers when read-only', () => {
    const { rerender } = render(
      <DocumentSlots pending={{}} onPick={() => undefined} missing={['REGISTRATION_CERT']} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('중개사무소 등록증');
    rerender(<DocumentSlots pending={{}} onPick={() => undefined} readOnly />);
    expect(screen.queryByLabelText('중개사무소 등록증 파일 선택')).not.toBeInTheDocument();
    expect(screen.getAllByText('제출한 파일이 없어요')).toHaveLength(4);
  });

  it('approved office: only the 보증서류 slot takes a renewed copy', async () => {
    const onPick = vi.fn();
    render(
      <DocumentSlots
        renewOnly
        existing={{
          REGISTRATION_CERT: {
            id: 'd1',
            type: 'REGISTRATION_CERT',
            mediaId: 'm1',
            fileName: '등록증.pdf',
            createdAt: '2025-03-10T03:00:00Z',
          },
          OTHER: {
            id: 'd2',
            type: 'OTHER',
            mediaId: 'm2',
            fileName: '공제증서_2025.pdf',
            createdAt: '2025-03-10T03:00:00Z',
          },
        }}
        pending={{}}
        onPick={onPick}
      />,
    );
    expect(screen.queryByLabelText('중개사무소 등록증 파일 교체')).not.toBeInTheDocument();
    const file = new File(['%PDF'], '공제증서_2026.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('손해배상책임 보증서류 갱신본 제출'), file);
    expect(onPick).toHaveBeenCalledWith('OTHER', file);
  });
});
