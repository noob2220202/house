'use client';
import { useToast } from '@house/ui';
import { useCallback } from 'react';

/**
 * Share a URL: the native share sheet where available (mobile), otherwise copy the link.
 * `path` is site-relative; the current origin is prepended.
 */
export function useShare(): (input: {
  title: string;
  text?: string;
  path?: string;
}) => Promise<void> {
  const { toast } = useToast();
  return useCallback(
    async ({ title, text, path }) => {
      const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (error) {
          // Dismissing the sheet is not an error; anything else falls back to copying.
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast({ message: '링크를 복사했어요.', tone: 'success' });
      } catch {
        toast({
          message: '링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.',
          tone: 'error',
        });
      }
    },
    [toast],
  );
}
