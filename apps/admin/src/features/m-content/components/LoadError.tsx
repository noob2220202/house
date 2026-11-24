'use client';
import { ErrorState } from '@house/ui';
import { ApiError, errorMessage } from '@/lib/api';

/** Error state for a failed query: Korean message, request id for support, retry button. */
export function LoadError({
  error,
  onRetry,
  title = '불러오지 못했어요',
  compact = true,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  return (
    <ErrorState
      compact={compact}
      title={title}
      description={errorMessage(error)}
      onRetry={onRetry}
      code={error instanceof ApiError ? (error.requestId ?? error.code) : undefined}
    />
  );
}
