'use client';
import { ToastProvider } from '@house/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from '@/lib/api/query';
import { SessionProvider } from '@/lib/auth/session';

/** App-wide client providers: TanStack Query → Session → Toast. Mounted once in the root layout. */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
