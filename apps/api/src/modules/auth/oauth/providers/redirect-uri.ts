import { API_PREFIX } from '@house/shared';
import type { AppConfig } from '../../../../config/app-config.service';

/** Fixed callback route registered in each provider console. */
export function defaultRedirectUri(config: AppConfig, slug: string): string {
  const base = config.get('API_BASE_URL').replace(/\/+$/, '');
  return `${base}/${API_PREFIX}/auth/oauth/${slug}/callback`;
}
