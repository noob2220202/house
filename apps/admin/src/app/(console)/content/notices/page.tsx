import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NoticesView } from '@/features/m-content/notices/NoticesView';

export const metadata: Metadata = { title: '공지사항 관리' };

export default function NoticesPage() {
  return (
    <Suspense>
      <NoticesView />
    </Suspense>
  );
}
