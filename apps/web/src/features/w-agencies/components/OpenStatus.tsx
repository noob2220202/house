'use client';
import { StatusPill } from '@house/ui';
import { useEffect, useState } from 'react';
import type { BusinessHours } from '../api/schemas';
import { openStateAt, type OpenState } from '../lib/hours';

export interface OpenStatusProps {
  hours: BusinessHours | null | undefined;
  /**
   * State computed on the server for the first paint. The client re-evaluates after mount and
   * every minute, so a cached page never claims "영업 중" at midnight.
   */
  initial?: OpenState | null;
  /** Append "19:00까지" / "09:00 오픈". */
  withHint?: boolean;
  className?: string;
}

/** 영업 중 / 영업 종료 pill from the office's opening hours (Asia/Seoul). Renders nothing when unknown. */
export function OpenStatus({ hours, initial, withHint, className }: OpenStatusProps) {
  const [state, setState] = useState<OpenState | null>(initial ?? null);
  useEffect(() => {
    const update = () => setState(openStateAt(hours));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours]);

  if (!state) return null;
  return (
    <StatusPill tone={state.open ? 'live' : 'ended'} className={className}>
      {state.label}
      {withHint && state.hint ? ` · ${state.hint}` : ''}
    </StatusPill>
  );
}
