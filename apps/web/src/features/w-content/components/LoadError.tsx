'use client';
import { ErrorState } from '@house/ui';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

export interface LoadErrorProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Request id / error code shown small for support. */
  code?: string;
  compact?: boolean;
}

/**
 * Inline error state for a server-rendered data view: "다시 시도" re-runs the server fetch
 * (router.refresh) without losing the page chrome.
 */
export function LoadError({ title, description, code, compact }: LoadErrorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ErrorState
      title={title}
      description={description}
      code={code}
      compact={compact}
      retryLabel={pending ? '불러오는 중…' : '다시 시도'}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
