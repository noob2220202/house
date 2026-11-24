'use client';
import { ToastProvider } from '@house/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from '@/lib/api/query';

/** App-wide client providers: TanStack Query → Toast. (The admin session provider wraps the console layout.) */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
