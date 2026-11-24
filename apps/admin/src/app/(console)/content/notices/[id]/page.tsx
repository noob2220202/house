import type { Metadata } from 'next';
import { NoticeEditor } from '@/features/m-content/notices/NoticeEditor';

export const metadata: Metadata = { title: '공지 수정' };

export default async function NoticeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoticeEditor id={id} />;
}
