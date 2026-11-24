import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListFallback } from '@/features/m-moderation/ui/ListFallback';
import { UsersListView } from '@/features/m-moderation/users/UsersListView';

export const metadata: Metadata = { title: '회원 관리' };

/** 회원 관리: member search (masked personal data). List state lives in the query string. */
export default function UsersPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <UsersListView />
    </Suspense>
  );
}
