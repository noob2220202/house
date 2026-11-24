import { redirect } from 'next/navigation';
import { ADMIN_ROUTES } from '@/config/nav';

export default function ContentIndexPage() {
  redirect(ADMIN_ROUTES.notices);
}
