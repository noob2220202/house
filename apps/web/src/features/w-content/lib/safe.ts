import { ApiError } from '@/lib/api/errors';

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * Runs a server fetch and turns an ApiError into a value, so the page can render an inline error
 * state inside its normal layout instead of falling through to the route error boundary.
 * Non-API errors (bugs) still throw.
 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error };
    throw error;
  }
}
