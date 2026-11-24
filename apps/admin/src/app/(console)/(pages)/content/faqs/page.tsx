import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FaqsView } from '@/features/m-content/faqs/FaqsView';

export const metadata: Metadata = { title: 'FAQ 관리' };

export default function FaqsPage() {
  return (
    <Suspense>
      <FaqsView />
    </Suspense>
  );
}
