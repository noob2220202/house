export interface AuditOptions {
    /** Dotted verb, e.g. "banner.update", "agency.approve". */
    action: string;
    /** Prisma model name, e.g. "Banner". */
    resourceType: string;
    /** Route param holding the resource id (default "id"); falls back to response `id`. */
    idParam?: string;
}
/** Records an AuditLog row after the handler succeeds (see AuditInterceptor). */
export declare const Audit: (options: AuditOptions) => MethodDecorator;
