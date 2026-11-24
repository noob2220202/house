import { AuthProvider } from '@house/shared';

const KEY = 'house:auth:recent-provider';
const isProvider = (v: unknown): v is AuthProvider =>
  typeof v === 'string' && Object.values(AuthProvider).includes(v as AuthProvider);

/** Provider of the last successful login on this browser ("최근 사용" hint). Not a credential. */
export function readRecentProvider(): AuthProvider | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return isProvider(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeRecentProvider(provider: AuthProvider): void {
  try {
    window.localStorage.setItem(KEY, provider);
  } catch {
    /* storage unavailable (private mode) — the hint is optional */
  }
}

export function clearRecentProvider(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
