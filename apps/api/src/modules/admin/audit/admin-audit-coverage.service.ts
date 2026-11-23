import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { AUDIT_KEY } from '../../../common/decorators/metadata-keys';

export interface AdminMutationRoute {
  controller: string;
  handler: string;
  method: string;
  path: string;
  /** Has @Audit(...) (otherwise the handler audits in its service, or the fallback does). */
  decorated: boolean;
}

function joinPath(...parts: (string | string[] | undefined)[]): string {
  return parts
    .map((p) => (Array.isArray(p) ? (p[0] ?? '') : (p ?? '')))
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/');
}

/**
 * Inventory of every admin mutation route in the app (all modules) and whether it carries
 * @Audit. Logged once at bootstrap so a missing decorator is visible; AdminMutationAuditInterceptor
 * guarantees the audit row either way.
 */
@Injectable()
export class AdminAuditCoverageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminAuditCoverageService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const undecorated = this.adminMutationRoutes().filter((r) => !r.decorated);
    if (undecorated.length > 0) {
      this.logger.log(
        { routes: undecorated.map((r) => `${r.method} /${r.path} (${r.controller}.${r.handler})`) },
        'admin mutations without @Audit (audited in service or by the fallback interceptor)',
      );
    }
  }

  adminMutationRoutes(): AdminMutationRoute[] {
    const routes: AdminMutationRoute[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as object | undefined;
      const metatype = wrapper.metatype;
      if (!instance || !metatype) continue;
      const base = this.reflector.get<string | string[] | undefined>(PATH_METADATA, metatype);
      if (!joinPath(base).startsWith('admin')) continue;
      const proto = Object.getPrototypeOf(instance) as object;
      for (const name of this.scanner.getAllMethodNames(proto)) {
        const handler = (proto as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const method = this.reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
        if (
          method === undefined ||
          ![
            RequestMethod.POST,
            RequestMethod.PUT,
            RequestMethod.PATCH,
            RequestMethod.DELETE,
          ].includes(method)
        ) {
          continue;
        }
        routes.push({
          controller: metatype.name,
          handler: name,
          method: RequestMethod[method],
          path: joinPath(
            base,
            this.reflector.get<string | string[] | undefined>(PATH_METADATA, handler),
          ),
          decorated: this.reflector.get(AUDIT_KEY, handler) !== undefined,
        });
      }
    }
    return routes;
  }
}
