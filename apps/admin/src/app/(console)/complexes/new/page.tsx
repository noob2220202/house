import type { Metadata } from 'next';
import { ComplexCreateView } from '@/features/m-content/complexes/ComplexDetailView';

export const metadata: Metadata = { title: '단지 등록' };

export default function ComplexCreatePage() {
  return <ComplexCreateView />;
}
