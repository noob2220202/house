import { siteSlugFromHost } from '@house/shared';
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
  /**
   * Parent domain of the 사무소 홈페이지 hosts (AppConfig.siteRootDomain). When set, user routes
   * also accept `<PUBLIC_BASE_URL protocol>//<slug>.<siteRootDomain>[:<PUBLIC_BASE_URL port>]`
   * for any label that passes the office slug rules (reserved labels such as admin / www never).
   */
  siteRootDomain?: string | null;
}

/**
 * Browser origins the API accepts, split by surface. Used by both the CORS delegate
 * (bootstrap/configure-app.ts) and CsrfGuard, so the two checks cannot drift apart.
 *
 *  - /api/v1/admin/** (isAdminPath): ADMIN_BASE_URL's origin + ADMIN_CORS_ORIGINS.
 *  - every other route:             PUBLIC_BASE_URL's origin + CORS_ORIGINS; CsrfGuard also lets
 *                                    the office site hosts `<slug>.<SITE_ROOT_DOMAIN>` through
 *                                    (isSiteOrigin), CORS never does.
 *
 * The other surface's base origin is never accepted, even when it is listed among the extras
 * (older .env files put both sites in CORS_ORIGINS). Otherwise any script running on the public
 * site (an XSS bug, a compromised map/postcode CDN script) could read the admin CSRF token with a
 * credentialed fetch to admin.<domain> — the two hosts are same-site, so the admin cookie goes
 * along — and act as the logged-in admin.
 *
 * Office sites are a pattern, not a list: a browser on `https://<slug>.suncheonmap.kr` sends that
 * Origin on its same-origin POSTs (view beacons, guest inquiries) that nginx proxies to this API.
 * Sessions stay host-only (COOKIE_DOMAIN empty), so those requests are anonymous; accepting the
 * origin only lets them through CsrfGuard. They never get CORS: the office pages call the API on
 * their own host and need none, and a credentialed cross-origin fetch from an office host to the
 * apex API would carry the main-site session (SameSite=Lax is site-based) — CORS for that would
 * turn any script injection on any office host into a main-site account takeover.
 * The admin surface never accepts them.
 */
export class OriginPolicy {
  readonly user: ReadonlySet<string>;
  readonly admin: ReadonlySet<string>;
  private readonly site: {
    root: string;
    protocol: string;
    port: string;
    adminOrigin: string;
  } | null;

  constructor(input: OriginPolicyInput) {
    const publicUrl = new URL(input.publicBaseUrl);
    const publicOrigin = publicUrl.origin;
    const adminOrigin = new URL(input.adminBaseUrl).origin;
    const root = input.siteRootDomain?.trim().toLowerCase().replace(/\.$/, '') ?? '';
    // An IP literal has no sub-domains: no office hosts under it.
    this.site =
      root && !/^[\d.]+$/.test(root) && !root.includes(':')
        ? { root, protocol: publicUrl.protocol, port: publicUrl.port, adminOrigin }
        : null;
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
      siteRootDomain: config.siteRootDomain,
    });
  }

  /**
   * The CORS list for the request's surface (decided by its path). Office-site origins are never
   * in it (see the class comment): only CsrfGuard's `allows` accepts them.
   */
  forRequest(req: Request): ReadonlySet<string> {
    return isAdminPath(req) ? this.admin : this.user;
  }

  /** CsrfGuard: the surface's list, plus the office-site hosts on the user surface. */
  allows(req: Request, origin: string): boolean {
    if (isAdminPath(req)) return this.admin.has(origin);
    return this.user.has(origin) || this.isSiteOrigin(origin);
  }

  /**
   * `origin` is exactly `<protocol>//<label>.<root>[:<port>]` (serialized form, as browsers send
   * it) with PUBLIC_BASE_URL's protocol and port, and `label` is a usable office slug.
   */
  isSiteOrigin(origin: string): boolean {
    const site = this.site;
    if (!site || origin === site.adminOrigin) return false;
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    if (url.origin !== origin || url.protocol !== site.protocol || url.port !== site.port) {
      return false;
    }
    return siteSlugFromHost(url.hostname, site.root) !== null;
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
