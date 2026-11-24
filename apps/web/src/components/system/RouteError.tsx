'use client';
import { Button, ErrorState } from '@house/ui';
import Link from 'next/link';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api/errors';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Shared body of error.tsx boundaries: friendly message, retry, home link, support code. */
export function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const api = error instanceof ApiError ? error : null;
  return (
    <div
      style={{ display: 'grid', placeItems: 'center', minHeight: '60dvh', padding: '24px 16px' }}
    >
      <ErrorState
        title={api?.isNetwork ? '연결이 원활하지 않아요' : '페이지를 불러오지 못했어요'}
        description={
          api?.isNetwork
            ? '네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
            : '일시적인 문제일 수 있어요. 다시 시도해도 같은 화면이 보이면 고객센터로 알려 주세요.'
        }
        onRetry={reset}
        action={
          <Button href="/" linkAs={Link} variant="ghost">
            홈으로
          </Button>
        }
        code={api?.requestId ?? error.digest}
      />
    </div>
  );
}
