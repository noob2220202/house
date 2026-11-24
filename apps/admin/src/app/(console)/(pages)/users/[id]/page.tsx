import type { Metadata } from 'next';
import { UserDetailView } from '@/features/m-moderation/users/UserDetailView';

export const metadata: Metadata = { title: '회원 상세' };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailView id={id} />;
}
