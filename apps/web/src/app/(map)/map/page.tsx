import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/nav';

/** /map → the apartment map (the first GNB category). */
export default function MapIndexPage() {
  redirect(ROUTES.map('apt'));
}
