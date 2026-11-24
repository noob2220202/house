import type { Metadata } from 'next';
import { NotificationsView } from '@/features/m-core/components/notifications/NotificationsView';

export const metadata: Metadata = { title: '알림' };

/** Notification centre behind the topbar bell. */
export default function NotificationsPage() {
  return <NotificationsView />;
}
