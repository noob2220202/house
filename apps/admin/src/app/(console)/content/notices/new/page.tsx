import type { Metadata } from 'next';
import { NoticeEditor } from '@/features/m-content/notices/NoticeEditor';

export const metadata: Metadata = { title: '새 공지 작성' };

export default function NoticeCreatePage() {
  return <NoticeEditor />;
}
