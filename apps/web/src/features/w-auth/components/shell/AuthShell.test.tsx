import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MiniFooter } from './AuthShell';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/brand/Logo', () => ({ Logo: () => <span>logo</span> }));
vi.mock('@/lib/site/settings', () => ({
  getBusinessInfo: async () => ({
    companyName: '순천부동산',
    ceoName: '김대표',
    businessNumber: '000-00-00000',
    mailOrderNumber: '2026-전남순천-0000',
    address: '전남광주통합특별시 순천시',
    privacyOfficer: '김보호',
    phone: '061-000-0000',
    email: 'help@example.com',
  }),
}));

describe('<MiniFooter> (login, signup, auth pages)', () => {
  it('shows the same 전자상거래법 표시사항 as the site footer, 통신판매업 신고번호 included', async () => {
    render(await MiniFooter());
    for (const [label, value] of [
      ['상호', '순천부동산'],
      ['사업자등록번호', '000-00-00000'],
      ['통신판매업 신고', '2026-전남순천-0000'],
      ['개인정보보호책임자', '김보호'],
    ] as const) {
      expect(screen.getByText(label, { selector: 'dt' }).parentElement).toHaveTextContent(value);
    }
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/terms/privacy',
    );
  });
});
