'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * A text box mirrored into external state (the URL query) after a pause.
 *
 * - Typing updates the returned text at once and calls `commit(trimmed)` `delay` ms after the last
 *   keystroke (only when it differs from what is already committed).
 * - An external change of `value` (back button, "필터 초기화") replaces the text.
 * - Our own commit arriving back as `value` never overwrites what was typed in the meantime.
 */
export function useDebouncedText(
  value: string,
  commit: (next: string) => void,
  delay = 350,
): [string, (text: string) => void] {
  const [text, setText] = useState(value);
  /** The value this hook last saw from outside or sent out itself. */
  const committed = useRef(value);
  const latestCommit = useRef(commit);
  useEffect(() => {
    latestCommit.current = commit;
  });

  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setText(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = text.trim();
      if (next === committed.current) return;
      committed.current = next;
      latestCommit.current(next);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return [text, setText];
}
