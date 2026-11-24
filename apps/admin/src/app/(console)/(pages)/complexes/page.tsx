import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ComplexesView } from '@/features/m-content/complexes/ComplexesView';

export const metadata: Metadata = { title: '단지 관리' };

export default function ComplexesPage() {
  return (
    <Suspense>
      <ComplexesView />
    </Suspense>
  );
}
