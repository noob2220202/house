/**
 * Only for cross-site POSTs that cannot carry a CSRF token (e.g. a future server-to-server webhook).
 * Every use must be justified in code review; OAuth callbacks are GET and don't need it.
 */
export declare const SkipCsrf: () => MethodDecorator & ClassDecorator;
