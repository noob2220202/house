import type { Request } from 'express';
import type { AppConfig } from '../../config/app-config.service';
import { isAdminPath } from './session-resolver';

export interface OriginPolicyInput {
  publicBaseUrl: string;
  adminBaseUrl: string;
  /** Extra origins for the user API (CORS_ORIGINS). */
  userOrigins: readonly string[];
  /** Extra origins for the admin API (ADMIN_CORS_ORIGINS). */
  adminOrigins: readonly string[];
}

/**
 * Browser origins the API accepts, split by surface. Used by both the CORS delegate
 * (bootstrap/configure-app.ts) and CsrfGuard, so the two checks cannot drift apart.
 *
 *  - /api/v1/admin/** (isAdminPath): ADMIN_BASE_URL's origin + ADMIN_CORS_ORIGINS.
 *  - every other route:             PUBLIC_BASE_URL's origin + CORS_ORIGINS.
 *
 * The other surface's base origin is never accepted, even when it is listed among the extras
 * (older .env files put both sites in CORS_ORIGINS). Otherwise any script running on the public
 * site (an XSS bug, a compromised map/postcode CDN script) could read the admin CSRF token with a
 * credentialed fetch to admin.<domain> — the two hosts are same-site, so the admin cookie goes
 * along — and act as the logged-in admin.
 */
export class OriginPolicy {
  readonly user: ReadonlySet<string>;
  readonly admin: ReadonlySet<string>;

  constructor(input: OriginPolicyInput) {
    const publicOrigin = new URL(input.publicBaseUrl).origin;
    const adminOrigin = new URL(input.adminBaseUrl).origin;
    const user = new Set([publicOrigin, ...input.userOrigins.map(toOrigin)]);
    const admin = new Set([adminOrigin, ...input.adminOrigins.map(toOrigin)]);
    if (publicOrigin !== adminOrigin) {
      user.delete(adminOrigin);
      admin.delete(publicOrigin);
    }
    this.user = user;
    this.admin = admin;
  }

  static fromConfig(config: AppConfig): OriginPolicy {
    return new OriginPolicy({
      publicBaseUrl: config.get('PUBLIC_BASE_URL'),
      adminBaseUrl: config.get('ADMIN_BASE_URL'),
      userOrigins: config.get('CORS_ORIGINS'),
      adminOrigins: config.get('ADMIN_CORS_ORIGINS'),
    });
  }

  /** The allowed set for the request's surface (decided by its path). */
  forRequest(req: Request): ReadonlySet<string> {
    return isAdminPath(req) ? this.admin : this.user;
  }

  allows(req: Request, origin: string): boolean {
    return this.forRequest(req).has(origin);
  }
}

/** "https://Example.kr/" → "https://example.kr" (env.schema already rejects non-URL entries). */
function toOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
