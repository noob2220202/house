export interface PollOptions {
  /** Maximum number of extra fetches after the first value. */
  tries: number;
  /** Pause between fetches in ms. */
  delayMs: number;
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Returns `first` when it is already `done`, otherwise re-fetches with `next` (pausing in between)
 * until it is done or the tries run out. The last value is returned either way — the caller checks it.
 */
export async function pollUntil<T>(
  first: T,
  next: (current: T) => Promise<T>,
  done: (value: T) => boolean,
  { tries, delayMs, sleep = defaultSleep }: PollOptions,
): Promise<T> {
  let value = first;
  for (let i = 0; i < tries && !done(value); i += 1) {
    await sleep(delayMs);
    value = await next(value);
  }
  return value;
}
