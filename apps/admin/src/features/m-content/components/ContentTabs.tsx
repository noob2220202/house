'use client';
import { AdminRole } from '@house/shared';
import { Tabs } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_ROUTES } from '@/config/nav';
import { useAdminSession } from '@/lib/auth';

const ITEMS = [
  { value: 'notices', label: '공지사항', href: ADMIN_ROUTES.notices },
  { value: 'faqs', label: 'FAQ', href: ADMIN_ROUTES.faqs },
  { value: 'videos', label: '동네TV', href: ADMIN_ROUTES.videos },
] as const;
/** Stored as a site setting, so it needs ADMIN (the page guards it server-side too). */
const HOME_ITEM = {
  value: 'home',
  label: '메인 화면 편집',
  href: ADMIN_ROUTES.homeEditor,
} as const;

/** Section tabs of 콘텐츠. Hidden on editor sub-pages (/content/notices/new, /content/notices/:id). */
export function ContentTabs() {
  const pathname = usePathname();
  const { can } = useAdminSession();
  const [, , section, sub] = pathname.split('/');
  if (sub) return null;
  const items = can(AdminRole.ADMIN) ? [...ITEMS, HOME_ITEM] : ITEMS;
  return (
    <Tabs
      label="콘텐츠 종류"
      items={items}
      value={items.find((i) => i.value === section)?.value ?? 'notices'}
      linkAs={Link}
    />
  );
}
