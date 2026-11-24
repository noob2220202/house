import type { Metadata } from 'next';
import { ReportDetailView } from '@/features/m-moderation/reports/ReportDetailView';

export const metadata: Metadata = { title: '신고 처리' };

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailView id={id} />;
}
