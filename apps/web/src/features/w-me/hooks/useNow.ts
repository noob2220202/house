'use client';
import { useEffect, useState } from 'react';

/**
 * Clock for relative times ("12분 전", 오늘 / 어제 buckets) in server-rendered lists.
 * The first render uses the instant the SERVER rendered at (`serverNow`, passed down as a prop), so
 * the HTML and the hydration pass print the same text; after mount it follows the real clock and
 * ticks once a minute.
 */
export function useNow(serverNow?: number): Date {
  const [now, setNow] = useState(() => new Date(serverNow ?? Date.now()));
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
