import type { Metadata } from 'next';
import { AgencyDetailView } from '@/features/m-moderation/agencies/AgencyDetailView';

export const metadata: Metadata = { title: '중개사무소 심사' };

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgencyDetailView id={id} />;
}
