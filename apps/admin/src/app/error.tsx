'use client';
import { ErrorState } from '@house/ui';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24 }}>
      <ErrorState title="화면을 불러오지 못했어요" onRetry={reset} code={error.digest} />
    </main>
  );
}
