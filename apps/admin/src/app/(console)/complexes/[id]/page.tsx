import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ComplexDetailView } from '@/features/m-content/complexes/ComplexDetailView';

export const metadata: Metadata = { title: '단지 상세' };

export default async function ComplexDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ComplexDetailView id={id} />
    </Suspense>
  );
}
