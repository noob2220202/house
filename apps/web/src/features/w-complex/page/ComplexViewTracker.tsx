'use client';
import { useEffect, useRef } from 'react';
import { recordComplexView } from '../api/queries';

/** Counts the 단지 page view once per page visit (see `recordComplexView`). Renders nothing. */
export function ComplexViewTracker({ complexId }: { complexId: string }) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (done.current === complexId) return;
    done.current = complexId;
    recordComplexView(complexId).catch(() => undefined);
  }, [complexId]);
  return null;
}
