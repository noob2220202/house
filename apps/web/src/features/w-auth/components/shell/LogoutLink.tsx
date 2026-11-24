'use client';
import { useState } from 'react';
import { useSession } from '@/lib/auth';
import { authBarLinkClass } from './AuthShell.classes';

/** "다음에 할게요 · 로그아웃" escape hatch in the slim auth top bar. */
export function LogoutLink({ label = '로그아웃' }: { label?: string }) {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={authBarLinkClass}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void logout();
      }}
    >
      {label}
    </button>
  );
}
