'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { SessionUser } from '@/lib/auth';

const ConsoleUserContext = createContext<SessionUser | null>(null);

/** The signed-in user resolved on the server by the console layout (null when signed out). */
export function ConsoleUserProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: ReactNode;
}) {
  return <ConsoleUserContext.Provider value={user}>{children}</ConsoleUserContext.Provider>;
}

export function useConsoleUser(): SessionUser | null {
  return useContext(ConsoleUserContext);
}
