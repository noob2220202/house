import type { Metadata } from 'next';
import { ListingDetailView } from '@/features/m-moderation/listings/ListingDetailView';

export const metadata: Metadata = { title: '매물 검수' };

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingDetailView id={id} />;
}
