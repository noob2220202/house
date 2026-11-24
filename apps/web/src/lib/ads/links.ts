import { API_BASE_PATH } from '@/lib/api/config';

/** Click-through URL of a banner: the ads click-redirect endpoint (counts the click, then 302s). */
export function bannerClickHref(bannerId: string): string {
  return `${API_BASE_PATH}/banners/${encodeURIComponent(bannerId)}/click`;
}
