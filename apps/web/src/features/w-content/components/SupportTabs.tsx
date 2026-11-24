import { Tabs } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';

export type SupportTab = 'support' | 'notices' | 'faq' | 'terms';

const ITEMS = [
  { value: 'support', label: '고객센터', href: ROUTES.support },
  { value: 'notices', label: '공지사항', href: ROUTES.notices },
  { value: 'faq', label: '자주 묻는 질문', href: ROUTES.faq },
  { value: 'terms', label: '약관 · 정책', href: ROUTES.terms('service') },
] as const;

/** Link tabs shared by the 고객지원 pages (고객센터 · 공지사항 · 자주 묻는 질문 · 약관·정책). */
export function SupportTabs({ current }: { current: SupportTab }) {
  return <Tabs label="고객지원 메뉴" items={ITEMS} value={current} linkAs={Link} />;
}
