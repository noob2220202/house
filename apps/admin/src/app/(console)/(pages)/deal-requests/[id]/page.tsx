import type { Metadata } from 'next';
import { DealRequestDetailView } from '@/features/m-moderation/deal-requests/DealRequestDetailView';

export const metadata: Metadata = { title: '내놓기·구하기 상세' };

export default async function DealRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DealRequestDetailView id={id} />;
}
